"""
Lucy LMS - Student Performance ML Service (OOP)
FastAPI microservice that:
1. Trains on the lms_advanced_dataset.csv (2000 records)
2. Can also aggregate features from PostgreSQL for live predictions
3. Trains a Random Forest classifier to predict pass/fail
4. Exposes prediction & analytics endpoints

Run: cd apps/ml && uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os, json
from pathlib import Path
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import psycopg2
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib


# ─── Config ───────────────────────────────────────────────────────────────────
class Config:
    DATABASE_URL = os.environ.get('DATABASE_URL')
    MODEL_DIR = Path(__file__).parent / 'models'
    MODEL_PATH = MODEL_DIR / 'performance_model.joblib'
    FEATURES_PATH = MODEL_DIR / 'feature_stats.json'
    CSV_PATH = Path(__file__).parent / 'lms_advanced_dataset.csv'
    FEATURE_COLUMNS = [
        'attendance', 'quiz_score', 'participation', 'video_watch',
        'ppt_progress', 'has_video', 'has_ppt', 'assignment_score', 'course_type_encoded'
    ]
    TARGET_COLUMN = 'pass'
    COURSE_TYPE_MAP = {'f2f': 0, 'online': 1, 'blended': 2}

    @classmethod
    def load_database_url(cls):
        if not cls.DATABASE_URL:
            env_path = os.path.join(os.path.dirname(__file__), '..', 'api', '.env')
            try:
                with open(env_path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('DATABASE_URL='):
                            cls.DATABASE_URL = line.split('=', 1)[1].strip('"').strip("'")
                            break
            except FileNotFoundError:
                pass


# ─── Feature Engineer ────────────────────────────────────────────────────────
class FeatureEngineer:
    """Handles feature preparation and statistics for ML."""

    def __init__(self, config: Config = None):
        self.config = config or Config()

    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df['course_type_encoded'] = df['course_type'].map(self.config.COURSE_TYPE_MAP).fillna(1).astype(int)
        df['has_video'] = df['has_video'].astype(int)
        df['has_ppt'] = df['has_ppt'].astype(int)
        df['pass'] = df['pass'].astype(int)
        for col in self.config.FEATURE_COLUMNS:
            if col in df.columns:
                df[col] = df[col].fillna(0)
        return df

    def save_feature_stats(self, df: pd.DataFrame):
        stats = {}
        for col in self.config.FEATURE_COLUMNS:
            if col in df.columns:
                stats[col] = {
                    'mean': float(df[col].mean()),
                    'std': float(df[col].std()),
                    'min': float(df[col].min()),
                    'max': float(df[col].max()),
                }
        self.config.MODEL_DIR.mkdir(exist_ok=True)
        with open(self.config.FEATURES_PATH, 'w') as f:
            json.dump(stats, f, indent=2)

    def load_feature_stats(self) -> dict:
        if self.config.FEATURES_PATH.exists():
            with open(self.config.FEATURES_PATH) as f:
                return json.load(f)
        return {}

    def build_feature_vector(self, features: dict) -> list:
        course_type = features.get('course_type', 'online')
        course_type_encoded = self.config.COURSE_TYPE_MAP.get(course_type, 1)
        return [[
            float(features.get('attendance', 0)),
            float(features.get('quiz_score', 0)),
            float(features.get('participation', 0)),
            float(features.get('video_watch', 0)),
            float(features.get('ppt_progress', 0)),
            int(features.get('has_video', 0)),
            int(features.get('has_ppt', 0)),
            float(features.get('assignment_score', 0)),
            course_type_encoded,
        ]]


# ─── Data Repository ─────────────────────────────────────────────────────────
class DataRepository:
    """Handles database connections and data fetching."""

    def __init__(self, config: Config = None):
        self.config = config or Config()

    def get_connection(self):
        if not self.config.DATABASE_URL:
            return None
        return psycopg2.connect(self.config.DATABASE_URL)

    def fetch_student_features(self, student_id: str):
        conn = self.get_connection()
        if not conn:
            return None
        try:
            # First get grade component weights for the course section
            query = """
                SELECT
                    cs."deliveryMode" AS course_type,
                    COALESCE(a.score, 0) AS attendance,
                    COALESCE(sg."quizScore",
                        (SELECT SUM(attempt.score * 1.0 / ass."maxScore" * gc.weight)
                         FROM "Assessment" ass
                         JOIN "GradeComponent" gc ON gc.id = ass."componentId"
                         JOIN "Attempt" attempt ON attempt."assessmentId" = ass.id AND attempt."studentId" = %s AND attempt.status IN ('SUBMITTED', 'GRADED')
                         WHERE ass."courseId" = cs."courseId" AND (LOWER(gc.name) LIKE '%%quiz%%' OR (ass."examType" = 'QUIZ' AND LOWER(gc.name) NOT LIKE '%%assign%%' AND LOWER(gc.name) NOT LIKE '%%assai%%' AND LOWER(gc.name) NOT LIKE '%%midterm%%' AND LOWER(gc.name) NOT LIKE '%%mid%%' AND LOWER(gc.name) NOT LIKE '%%final%%'))
                         HAVING COUNT(attempt.id) > 0), NULL) AS quiz_score,
                    COALESCE(sg."assignmentScore",
                        (SELECT SUM(attempt.score * 1.0 / ass."maxScore" * gc.weight)
                         FROM "Assessment" ass
                         JOIN "GradeComponent" gc ON gc.id = ass."componentId"
                         JOIN "Attempt" attempt ON attempt."assessmentId" = ass.id AND attempt."studentId" = %s AND attempt.status IN ('SUBMITTED', 'GRADED')
                         WHERE ass."courseId" = cs."courseId" AND (ass."examType" = 'ASSIGNMENT' OR LOWER(gc.name) LIKE '%%assign%%' OR LOWER(gc.name) LIKE '%%assai%%')
                         HAVING COUNT(attempt.id) > 0), NULL) AS assignment_score,
                    COALESCE(sg."midtermScore",
                        (SELECT SUM(attempt.score * 1.0 / ass."maxScore" * gc.weight)
                         FROM "Assessment" ass
                         JOIN "GradeComponent" gc ON gc.id = ass."componentId"
                         JOIN "Attempt" attempt ON attempt."assessmentId" = ass.id AND attempt."studentId" = %s AND attempt.status IN ('SUBMITTED', 'GRADED')
                         WHERE ass."courseId" = cs."courseId" AND (ass."examType" = 'MIDTERM' OR LOWER(gc.name) LIKE '%%midterm%%' OR LOWER(gc.name) LIKE '%%mid%%')
                         HAVING COUNT(attempt.id) > 0), NULL) AS midterm_score,
                    COALESCE(sg."finalScore",
                        (SELECT SUM(attempt.score * 1.0 / ass."maxScore" * gc.weight)
                         FROM "Assessment" ass
                         JOIN "GradeComponent" gc ON gc.id = ass."componentId"
                         JOIN "Attempt" attempt ON attempt."assessmentId" = ass.id AND attempt."studentId" = %s AND attempt.status IN ('SUBMITTED', 'GRADED')
                         WHERE ass."courseId" = cs."courseId" AND (ass."examType" = 'FINAL' OR LOWER(gc.name) LIKE '%%final%%')
                         HAVING COUNT(attempt.id) > 0), NULL) AS final_score,
                    COALESCE(sg."attendanceScore", NULL) AS attendance_score,
                    COALESCE((SELECT AVG(LEAST("durationSec"::float / 3600.0, 1.0))
                        FROM "MaterialView" WHERE "studentId" = %s), 0) AS participation,
                    COALESCE((SELECT AVG(
                        CASE WHEN m."fileType" IN ('VIDEO', 'video', 'mp4', 'webm') OR m."htmlContent" IS NOT NULL
                             THEN LEAST(mv."durationSec"::float / 3600.0, 1.0) ELSE 0 END)
                        FROM "MaterialView" mv JOIN "Material" m ON m.id = mv."materialId"
                        WHERE mv."studentId" = %s AND (m."fileType" IN ('VIDEO', 'video', 'mp4', 'webm') OR m."htmlContent" IS NOT NULL)), 0) AS video_watch,
                    COALESCE((SELECT AVG(
                        CASE WHEN "totalSlides" > 0
                             THEN "completedSlides"::float / "totalSlides" ELSE 0 END)
                        FROM "MaterialReadingProgress" WHERE "studentId" = %s), 0) AS ppt_progress,
                    CASE WHEN (SELECT COUNT(*) FROM "MaterialView" mv JOIN "Material" m ON m.id = mv."materialId"
                        WHERE mv."studentId" = %s AND (m."fileType" IN ('VIDEO', 'video', 'mp4', 'webm') OR m."htmlContent" IS NOT NULL)) > 0 THEN 1 ELSE 0 END AS has_video,
                    CASE WHEN (SELECT COUNT(*) FROM "MaterialReadingProgress" WHERE "studentId" = %s) > 0 THEN 1 ELSE 0 END AS has_ppt,
                    cs."courseId",
                    c.title AS course_title,
                    c.code AS course_code,
                    cs.id AS section_id
                FROM "StudentEnrollment" se
                JOIN "CourseSection" cs ON cs.id = se."courseSectionId"
                JOIN "Course" c ON c.id = cs."courseId"
                JOIN "Semester" sem ON sem.id = cs."semesterId"
                LEFT JOIN "StudentGrade" sg ON sg."enrollmentId" = se.id
                LEFT JOIN "Attendance" a ON a."studentId" = %s AND a."courseId" = cs."courseId"
                WHERE se."studentId" = %s AND se.status = 'ENROLLED'
                    AND sem.status IN ('IN_PROGRESS', 'REGISTRATION_OPEN', 'UPCOMING')
            """
            cur = conn.cursor()
            cur.execute(query, (student_id, student_id, student_id, student_id, student_id, student_id, student_id, student_id, student_id, student_id, student_id))
            rows = cur.fetchall()

            # Get grade component weights per course section
            section_ids = [r[14] for r in rows]  # section_id is at index 14
            weight_map = {}
            if section_ids:
                placeholders = ','.join(['%s'] * len(section_ids))
                cur.execute(f'''
                    SELECT gc."courseId", gc.name, gc.weight
                    FROM "GradeComponent" gc
                    WHERE gc."courseId" IN ({placeholders})
                ''', tuple(set(r[12] for r in rows)))  # course_id at index 12
                for wr in cur.fetchall():
                    course_id, comp_name, comp_weight = wr
                    if course_id not in weight_map:
                        weight_map[course_id] = {}
                    weight_map[course_id][comp_name.lower()] = comp_weight

            cur.close()
            conn.close()

            # Normalize scores: only use graded components, scale to 0-100 based on graded portion
            normalized_rows = []
            for row in rows:
                course_type, attendance, quiz_score, assignment_score, midterm_score, final_score, attendance_score, \
                    participation, video_watch, ppt_progress, has_video, has_ppt, \
                    course_id, course_title, course_code, section_id = row

                # Get weights for this course, fallback to defaults
                cw = weight_map.get(course_id, {})
                # Match component names by pattern to handle misspellings/variations
                quiz_w = 25
                assignment_w = 10
                midterm_w = 25
                final_w = 40
                attendance_w = 0
                for name, w in cw.items():
                    if 'quiz' in name:
                        quiz_w = w
                    elif 'assign' in name or 'assai' in name:
                        assignment_w = w
                    elif 'midterm' in name or 'mid' in name:
                        midterm_w = w
                    elif 'final' in name:
                        final_w = w
                    elif 'attend' in name:
                        attendance_w = w

                # Calculate normalized score from graded components only
                graded_sum = 0.0
                graded_weight = 0.0

                if quiz_score is not None:
                    graded_sum += quiz_score
                    graded_weight += quiz_w
                if assignment_score is not None:
                    graded_sum += assignment_score
                    graded_weight += assignment_w
                if midterm_score is not None:
                    graded_sum += midterm_score
                    graded_weight += midterm_w
                if final_score is not None:
                    graded_sum += final_score
                    graded_weight += final_w
                if attendance_score is not None:
                    graded_sum += attendance_score
                    graded_weight += attendance_w

                # Normalized score: scale graded portion to 0-100
                total_weight = quiz_w + assignment_w + midterm_w + final_w + attendance_w
                if graded_weight > 0 and total_weight > 0:
                    normalized_score = (graded_sum / graded_weight) * 100
                    graded_pct = (graded_weight / total_weight) * 100
                else:
                    normalized_score = 0.0
                    graded_pct = 0.0

                # For ungraded components, estimate from the student's graded performance
                # instead of using 0 (which unfairly penalizes students for work not yet submitted)
                estimated_score = normalized_score if normalized_score > 0 else 50  # default to 50% if nothing graded

                norm_quiz = (quiz_score / quiz_w * 100) if quiz_score is not None and quiz_w > 0 else estimated_score
                norm_assignment = (assignment_score / assignment_w * 100) if assignment_score is not None and assignment_w > 0 else estimated_score

                normalized_rows.append((
                    course_type, attendance,
                    norm_quiz,
                    participation, video_watch, ppt_progress,
                    has_video, has_ppt,
                    norm_assignment,
                    course_id, course_title, course_code,
                    normalized_score, graded_pct
                ))

            return normalized_rows
        except Exception as e:
            print(f"[ML] fetch_student_features error for {student_id}: {e}")
            if conn:
                conn.close()
            return None

    def load_csv_data(self) -> pd.DataFrame:
        if not self.config.CSV_PATH.exists():
            raise FileNotFoundError(f"CSV dataset not found at {self.config.CSV_PATH}")
        return pd.read_csv(self.config.CSV_PATH)


# ─── Model Service ───────────────────────────────────────────────────────────
class ModelService:
    """Handles model training, prediction, and persistence."""

    def __init__(self, config: Config = None, feature_engineer: FeatureEngineer = None):
        self.config = config or Config()
        self.feature_engineer = feature_engineer or FeatureEngineer(self.config)
        self.config.MODEL_DIR.mkdir(exist_ok=True)

    @property
    def is_trained(self) -> bool:
        return self.config.MODEL_PATH.exists()

    def load_model(self):
        if not self.is_trained:
            raise HTTPException(400, "Model not trained yet. Call /ml/train first.")
        return joblib.load(self.config.MODEL_PATH)

    def train(self, df: pd.DataFrame) -> dict:
        df = self.feature_engineer.engineer_features(df)
        self.feature_engineer.save_feature_stats(df)

        X = df[self.config.FEATURE_COLUMNS].values
        y = df[self.config.TARGET_COLUMN].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        rf = RandomForestClassifier(
            n_estimators=200, max_depth=12, random_state=42, class_weight='balanced'
        )
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        cv_scores = cross_val_score(rf, X, y, cv=5, scoring='accuracy')
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        cm = confusion_matrix(y_test, y_pred).tolist()
        importance = dict(zip(self.config.FEATURE_COLUMNS, rf.feature_importances_.tolist()))

        joblib.dump(rf, self.config.MODEL_PATH)

        return {
            'accuracy': round(acc, 4),
            'cv_mean': round(float(cv_scores.mean()), 4),
            'cv_std': round(float(cv_scores.std()), 4),
            'classification_report': report,
            'confusion_matrix': cm,
            'feature_importance': {
                k: round(v, 4) for k, v in sorted(importance.items(), key=lambda x: -x[1])
            },
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'trained_at': datetime.now().isoformat(),
            'data_source': 'csv',
        }

    def predict(self, features: dict) -> dict:
        model = self.load_model()
        x = self.feature_engineer.build_feature_vector(features)

        prediction = int(model.predict(x)[0])
        proba = model.predict_proba(x)[0].tolist()

        return {
            'prediction': 'PASS' if prediction == 1 else 'FAIL',
            'confidence': round(float(max(proba)), 4),
            'pass_probability': round(float(proba[1] if len(proba) > 1 else proba[0]), 4),
            'fail_probability': round(float(proba[0] if len(proba) > 1 else 1 - proba[0]), 4),
        }

    def predict_student(self, student_id: str, data_repo: DataRepository) -> dict:
        model = self.load_model()
        rows = data_repo.fetch_student_features(student_id)
        if not rows:
            raise HTTPException(404, f"No enrollment data found for student {student_id}")

        predictions = []
        for row in rows:
            course_type, attendance, quiz_score, participation, video_watch, ppt_progress, \
                has_video, has_ppt, assignment_score, course_id, course_title, course_code, \
                normalized_score, graded_pct = row

            ct_str = (course_type or 'ONLINE').lower()
            course_type_encoded = self.config.COURSE_TYPE_MAP.get(ct_str, 1)

            x = [[
                float(attendance or 0), float(quiz_score or 0), float(participation or 0),
                float(video_watch or 0), float(ppt_progress or 0), int(has_video or 0),
                int(has_ppt or 0), float(assignment_score or 0), course_type_encoded,
            ]]

            pred = int(model.predict(x)[0])
            proba = model.predict_proba(x)[0].tolist()

            predictions.append({
                'course_id': course_id,
                'course_title': course_title,
                'course_code': course_code,
                'prediction': 'PASS' if pred == 1 else 'FAIL',
                'pass_probability': round(float(proba[1] if len(proba) > 1 else proba[0]), 4),
                'features': {
                    'attendance': attendance, 'quiz_score': quiz_score, 'participation': participation,
                    'video_watch': video_watch, 'ppt_progress': ppt_progress,
                    'has_video': has_video, 'has_ppt': has_ppt, 'assignment_score': assignment_score,
                    'normalized_score': round(normalized_score, 1), 'graded_pct': round(graded_pct, 1),
                }
            })

        # Calculate cumulative GPA from all published grades (past semesters)
        current_cgpa = 0.0
        current_credits = 0
        try:
            conn2 = data_repo.get_connection()
            if conn2:
                cur2 = conn2.cursor()
                cur2.execute('''
                    SELECT sg."gradePoint", c."creditHours"
                    FROM "StudentEnrollment" se2
                    JOIN "StudentGrade" sg ON sg."enrollmentId" = se2.id
                    JOIN "CourseSection" cs ON cs.id = se2."courseSectionId"
                    JOIN "Course" c ON c.id = cs."courseId"
                    JOIN "Semester" sem ON sem.id = cs."semesterId"
                    WHERE se2."studentId" = %s AND sg."gradePoint" IS NOT NULL
                ''', (student_id,))
                past_rows = cur2.fetchall()
                cur2.close()
                conn2.close()
                total_pts = sum(r[0] * r[1] for r in past_rows if r[0] and r[1])
                total_cr = sum(r[1] for r in past_rows if r[0] and r[1])
                if total_cr > 0:
                    current_cgpa = round(total_pts / total_cr, 2)
                    current_credits = total_cr
        except Exception as e:
            print(f"[ML] CGPA calculation error: {e}")

        # Estimate expected grade points for current courses based on pass_probability
        # Use proper expected value: pass_prob * passing_grade_point + fail_prob * 0
        # The passing grade point is estimated from the student's current normalized score
        def prob_to_expected_gp(prob, norm_score=50):
            """Calculate expected grade point using probability-weighted expected value.
            If the student passes, their grade depends on their current performance level.
            If they fail, grade point is 0."""
            # Estimate passing grade point from normalized score (0-100 → 0-4.0)
            passing_gp = min(norm_score / 100.0 * 4.0, 4.0) if norm_score > 0 else 2.0
            # Expected value = P(pass) * passing_grade + P(fail) * 0
            return prob * passing_gp

        # Get credit hours for current courses
        predicted_points = 0.0
        predicted_credits = 0
        try:
            conn3 = data_repo.get_connection()
            if conn3:
                cur3 = conn3.cursor()
                course_ids = [p['course_id'] for p in predictions]
                if course_ids:
                    placeholders = ','.join(['%s'] * len(course_ids))
                    cur3.execute(f'''
                        SELECT id, "creditHours" FROM "Course" WHERE id IN ({placeholders})
                    ''', tuple(course_ids))
                    credit_map = {r[0]: r[1] for r in cur3.fetchall()}
                    for p in predictions:
                        cr = credit_map.get(p['course_id'], 3)
                        gp = prob_to_expected_gp(p['pass_probability'], p['features'].get('normalized_score', 50))
                        predicted_points += gp * cr
                        predicted_credits += cr
                cur3.close()
                conn3.close()
        except Exception as e:
            print(f"[ML] Credit hours lookup error: {e}")
            # Fallback: assume 3 credit hours per course
            for p in predictions:
                gp = prob_to_expected_gp(p['pass_probability'], p['features'].get('normalized_score', 50))
                predicted_points += gp * 3
                predicted_credits += 3

        # Calculate expected CGPA = (past points + predicted current points) / (past credits + current credits)
        total_points = (current_cgpa * current_credits) + predicted_points
        total_cr = current_credits + predicted_credits
        expected_cgpa = round(total_points / total_cr, 2) if total_cr > 0 else 0.0

        # Determine dropout risk and academic destination level
        if expected_cgpa >= 3.5:
            dropout_risk = "LOW"
            destination = "DISTINCTION"
            destination_level = 1
        elif expected_cgpa >= 3.0:
            dropout_risk = "LOW"
            destination = "HIGH_PERFORMANCE"
            destination_level = 2
        elif expected_cgpa >= 2.5:
            dropout_risk = "MODERATE"
            destination = "SATISFACTORY"
            destination_level = 3
        elif expected_cgpa >= 2.0:
            dropout_risk = "HIGH"
            destination = "AT_RISK"
            destination_level = 4
        else:
            dropout_risk = "CRITICAL"
            destination = "DROPOUT_LIKELY"
            destination_level = 5

        return {
            'student_id': student_id,
            'predictions': predictions,
            'current_cgpa': current_cgpa,
            'expected_cgpa': expected_cgpa,
            'dropout_risk': dropout_risk,
            'destination': destination,
            'destination_level': destination_level,
        }

    def get_feature_importance(self) -> dict:
        model = self.load_model()
        importance = dict(zip(self.config.FEATURE_COLUMNS, model.feature_importances_.tolist()))
        return {
            'feature_importance': {
                k: round(v, 4) for k, v in sorted(importance.items(), key=lambda x: -x[1])
            }
        }


# ─── Analytics Service ───────────────────────────────────────────────────────
class AnalyticsService:
    """Handles analytics computations from dataset and model."""

    def __init__(self, config: Config = None, feature_engineer: FeatureEngineer = None,
                 model_service: ModelService = None):
        self.config = config or Config()
        self.feature_engineer = feature_engineer or FeatureEngineer(self.config)
        self.model_service = model_service or ModelService(self.config, self.feature_engineer)

    def get_analytics(self, df: pd.DataFrame) -> dict:
        total = len(df)
        pass_rate = round(float(df['pass'].mean()) * 100, 1)

        df_eng = self.feature_engineer.engineer_features(df)
        correlations = {}
        if 'pass' in df_eng.columns:
            for col in self.config.FEATURE_COLUMNS:
                if col in df_eng.columns:
                    correlations[col] = round(float(df_eng[col].corr(df_eng['pass'])), 4)

        score_cols = ['attendance', 'quiz_score', 'assignment_score', 'final_score']
        score_bins = {}
        for col in score_cols:
            if col in df.columns:
                vals = df[col].dropna()
                score_bins[col] = {
                    'mean': round(float(vals.mean()), 1),
                    'median': round(float(vals.median()), 1),
                    'std': round(float(vals.std()), 1),
                    'min': round(float(vals.min()), 1),
                    'max': round(float(vals.max()), 1),
                }

        type_groups = {}
        for ct in df['course_type'].unique():
            sub = df[df['course_type'] == ct]
            type_groups[ct] = {
                'count': len(sub),
                'pass_rate': round(float(sub['pass'].mean() * 100), 1),
                'avg_final_score': round(float(sub['final_score'].mean()), 1),
                'avg_attendance': round(float(sub['attendance'].mean()), 1),
                'avg_quiz_score': round(float(sub['quiz_score'].mean()), 1),
            }

        at_risk = []
        at_risk_df = df[(df['final_score'] < 50) | ((df['attendance'] < 60) & (df['quiz_score'] < 40))]
        for _, row in at_risk_df.head(30).iterrows():
            at_risk.append({
                'student_id': int(row['student_id']),
                'final_score': round(float(row['final_score']), 1),
                'attendance': round(float(row['attendance']), 1),
                'course_type': row['course_type'],
                'risk_level': 'HIGH' if row['final_score'] < 35 else 'MEDIUM',
            })

        model_info = None
        if self.model_service.is_trained:
            model = self.model_service.load_model()
            model_info = {
                'trained': True,
                'feature_importance': dict(zip(self.config.FEATURE_COLUMNS,
                    [round(v, 4) for v in model.feature_importances_])),
            }
            feature_stats = self.feature_engineer.load_feature_stats()
            if feature_stats:
                model_info['feature_stats'] = feature_stats
        else:
            model_info = {'trained': False}

        return {
            'total_students': total,
            'pass_rate': pass_rate,
            'correlations': correlations,
            'score_distributions': score_bins,
            'course_type_comparison': type_groups,
            'at_risk_students': at_risk,
            'model': model_info,
        }


# ─── App Setup ───────────────────────────────────────────────────────────────
Config.load_database_url()

app = FastAPI(title="Lucy ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate services
config = Config()
feature_engineer = FeatureEngineer(config)
data_repo = DataRepository(config)
model_service = ModelService(config, feature_engineer)
analytics_service = AnalyticsService(config, feature_engineer, model_service)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "lucy-ml",
        "csv_data": config.CSV_PATH.exists(),
        "model_trained": model_service.is_trained,
    }


@app.post("/ml/train")
def train():
    try:
        df = data_repo.load_csv_data()
        if len(df) < 10:
            raise HTTPException(400, f"Not enough data to train. Found {len(df)} records, need at least 10.")

        required = {'student_id', 'course_type', 'attendance', 'quiz_score', 'participation',
                    'video_watch', 'ppt_progress', 'has_video', 'has_ppt', 'assignment_score',
                    'final_score', 'pass'}
        missing = required - set(df.columns)
        if missing:
            raise HTTPException(400, f"Missing columns in CSV: {missing}")

        result = model_service.train(df)
        result['data_points'] = len(df)
        result['csv_file'] = config.CSV_PATH.name
        result['dataset_stats'] = {
            'total_records': len(df),
            'pass_count': int(df['pass'].sum()),
            'fail_count': int(len(df) - df['pass'].sum()),
            'pass_rate': round(float(df['pass'].mean() * 100), 1),
            'course_types': df['course_type'].value_counts().to_dict(),
            'avg_attendance': round(float(df['attendance'].mean()), 1),
            'avg_quiz_score': round(float(df['quiz_score'].mean()), 1),
            'avg_assignment_score': round(float(df['assignment_score'].mean()), 1),
            'avg_final_score': round(float(df['final_score'].mean()), 1),
        }
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Training failed: {str(e)}")


@app.post("/ml/predict")
def predict(features: dict):
    return model_service.predict(features)


@app.api_route("/ml/predict-student/{student_id}", methods=["GET", "POST"])
def predict_student(student_id: str):
    return model_service.predict_student(student_id, data_repo)


@app.get("/ml/analytics")
def analytics():
    try:
        df = data_repo.load_csv_data()
    except FileNotFoundError:
        raise HTTPException(404, "CSV dataset not found")
    except Exception as e:
        raise HTTPException(500, f"Failed to load CSV: {str(e)}")

    if len(df) == 0:
        raise HTTPException(404, "No data available")

    return analytics_service.get_analytics(df)


@app.get("/ml/feature-importance")
def feature_importance():
    return model_service.get_feature_importance()

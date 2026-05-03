import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useTranslation } from 'react-i18next';
import { trainMLModel, getMLAnalytics, predictStudentById, getMLFeatureImportance } from '../api';
import Layout from '../components/Layout';
import {
  Brain, TrendingUp, AlertTriangle, BarChart3, Target, Play,
  CheckCircle, XCircle, Users, Monitor, BookOpen, Award,
  RefreshCw, ChevronDown, ChevronUp, Zap, Shield
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function StatCard({ icon: Icon, iconBg, iconColor, value, label, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function StudentPerformancePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [featureImportance, setFeatureImportance] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAtRisk, setShowAtRisk] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError('');
    try {
      const [analyticsData, importanceData] = await Promise.all([
        getMLAnalytics().catch(() => null),
        getMLFeatureImportance().catch(() => null),
      ]);
      setAnalytics(analyticsData);
      setFeatureImportance(importanceData?.feature_importance || null);

      // Students get their own predictions
      if (isStudent && user?.id) {
        const predData = await predictStudentById(user.id).catch(err => { console.error('predictStudentById failed:', err); return null; });
        setPredictions(predData);
      }
    } catch (err) {
      setError(err.message || t('ml.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }

  async function handleTrain() {
    setTraining(true);
    setTrainResult(null);
    try {
      const result = await trainMLModel();
      setTrainResult(result);
      // Reload analytics after training
      await loadAnalytics();
    } catch (err) {
      setTrainResult({ error: err.message || t('ml.trainingFailed') });
    } finally {
      setTraining(false);
    }
  }

  if (loading) return <Layout><div className="p-8">{t('common.loading')}</div></Layout>;

  const modelTrained = analytics?.model?.trained;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Brain className="w-7 h-7 text-indigo-600" />
              {t('ml.performanceAnalytics')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('ml.subtitle')}</p>
          </div>
          <button
              onClick={handleTrain}
              disabled={training}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {training ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> {t('ml.training')}</>
              ) : (
                <><Play className="w-4 h-4" /> {t('ml.trainModel')}</>
              )}
            </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Training Result */}
        {trainResult && !trainResult.error && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
              <CheckCircle className="w-5 h-5" />
              {t('ml.modelTrained')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400">{t('ml.accuracy')}:</span> <span className="font-semibold text-gray-900 dark:text-white">{(trainResult.accuracy * 100).toFixed(1)}%</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">{t('ml.cvScore')}:</span> <span className="font-semibold text-gray-900 dark:text-white">{(trainResult.cv_mean * 100).toFixed(1)}%</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">{t('ml.trainingSamples')}:</span> <span className="font-semibold text-gray-900 dark:text-white">{trainResult.training_samples}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400">{t('ml.testSamples')}:</span> <span className="font-semibold text-gray-900 dark:text-white">{trainResult.test_samples}</span></div>
            </div>
          </div>
        )}

        {trainResult?.error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-red-700 dark:text-red-400">
            {trainResult.error}
          </div>
        )}

        {/* Model Not Trained Warning */}
        {!modelTrained && !trainResult && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6 text-center">
            <Brain className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('ml.noModelYet')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('ml.trainFirst')}</p>
            <button onClick={handleTrain} disabled={training}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {training ? t('ml.training') : t('ml.trainModel')}
              </button>
          </div>
        )}

        {/* Analytics Overview */}
        {analytics && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <StatCard icon={Users} iconBg="bg-indigo-100 dark:bg-indigo-900/50" iconColor="text-indigo-600"
                value={analytics.total_students || 0} label={t('ml.totalStudents')} />
              <StatCard icon={TrendingUp} iconBg="bg-green-100 dark:bg-green-900/50" iconColor="text-green-600"
                value={`${analytics.pass_rate || 0}%`} label={t('ml.passRate')} />
              <StatCard icon={Monitor} iconBg="bg-blue-100 dark:bg-blue-900/50" iconColor="text-blue-600"
                value={Object.values(analytics.course_type_comparison || {}).reduce((s, v) => s + (v.count || 0), 0)} label={t('ml.totalEnrollments')} />
              <StatCard icon={BookOpen} iconBg="bg-purple-100 dark:bg-purple-900/50" iconColor="text-purple-600"
                value={analytics.course_type_comparison?.blended?.count || analytics.course_type_comparison?.f2f?.count || 0} label={t('ml.blendedStudents')} />
              <StatCard icon={AlertTriangle} iconBg="bg-red-100 dark:bg-red-900/50" iconColor="text-red-600"
                value={analytics.at_risk_students?.length || 0} label={t('ml.atRiskStudents')} />
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {/* Feature Importance Chart */}
              {featureImportance && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    {t('ml.featureImportance')}
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(featureImportance)
                      .map(([name, value]) => ({ name: t(`ml.feature_${name}`, name), value }))
                      .sort((a, b) => b.value - a.value)}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                      <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Course Type Comparison */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-600" />
                  {t('ml.courseTypeComparison')}
                </h3>
                {analytics.course_type_comparison && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      {
                        name: t('ml.passRate'),
                        ...Object.fromEntries(Object.entries(analytics.course_type_comparison).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v.pass_rate || 0])),
                      },
                      {
                        name: t('ml.avgScore'),
                        ...Object.fromEntries(Object.entries(analytics.course_type_comparison).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v.avg_final_score || 0])),
                      },
                      {
                        name: t('ml.studentCount'),
                        ...Object.fromEntries(Object.entries(analytics.course_type_comparison).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v.count || 0])),
                      },
                    ]}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {Object.keys(analytics.course_type_comparison).map((type, i) => (
                        <Bar key={type} dataKey={type.charAt(0).toUpperCase() + type.slice(1)} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Score Distributions & Correlations */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {/* Score Distribution */}
              {analytics.score_distributions && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    {t('ml.scoreDistribution')}
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(analytics.score_distributions).map(([key, stats], i) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-28 text-sm text-gray-600 dark:text-gray-400 capitalize">{t(`ml.feature_${key}`, key.replace('_', ' '))}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min((stats.mean / 100) * 100, 100)}%`,
                            backgroundColor: COLORS[i % COLORS.length]
                          }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">
                          {stats.mean?.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature Correlations */}
              {analytics.correlations && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    {t('ml.featureCorrelations')}
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.correlations)
                      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                      .map(([key, value], i) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-36 text-sm text-gray-600 dark:text-gray-400">{t(`ml.feature_${key}`, key.replace('_', ' '))}</span>
                          <div className="flex-1 flex items-center">
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 relative">
                              <div className="absolute top-0 left-1/2 w-px h-3 bg-gray-400" />
                              <div className="h-full rounded-full absolute" style={{
                                left: value >= 0 ? '50%' : `${50 + value * 50}%`,
                                width: `${Math.abs(value) * 50}%`,
                                backgroundColor: value >= 0 ? '#10b981' : '#ef4444'
                              }} />
                            </div>
                          </div>
                          <span className={`text-sm font-medium w-14 text-right ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {value >= 0 ? '+' : ''}{value?.toFixed(3)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* At-Risk Students (Admin/Teacher only) */}
            {(isAdmin || isTeacher) && analytics.at_risk_students?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setShowAtRisk(!showAtRisk)}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    {t('ml.atRiskStudents')} ({analytics.at_risk_students.length})
                  </h3>
                  {showAtRisk ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                {showAtRisk && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400">{t('ml.studentId')}</th>
                          <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400">{t('ml.finalScore')}</th>
                          <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400">{t('ml.attendance')}</th>
                          <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400">{t('ml.courseType')}</th>
                          <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400">{t('ml.riskLevel')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.at_risk_students.map((s, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="px-3 py-2 text-gray-900 dark:text-white font-mono text-xs">{s.student_id?.slice(0, 12)}...</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white">{s.final_score}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white">{s.attendance}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                {(s.course_type || '').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                s.risk_level === 'HIGH'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                              }`}>
                                {s.risk_level}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Student Predictions */}
        {isStudent && predictions && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              {t('ml.yourPerformancePrediction')}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.predictions?.map((pred, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{pred.course_title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{pred.course_code}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      pred.prediction === 'PASS'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                    }`}>
                      {pred.prediction === 'PASS' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                      {pred.prediction}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full" style={{
                      width: `${pred.pass_probability * 100}%`,
                      backgroundColor: pred.pass_probability >= 0.7 ? '#10b981' : pred.pass_probability >= 0.4 ? '#f59e0b' : '#ef4444'
                    }} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('ml.passProbability')}: {(pred.pass_probability * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Info */}
        {analytics?.model && modelTrained && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              {t('ml.modelInfo')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('ml.algorithm')}</p>
                <p className="font-medium text-gray-900 dark:text-white">Random Forest</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('ml.features')}</p>
                <p className="font-medium text-gray-900 dark:text-white">9 {t('ml.featuresCount')}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('ml.target')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{t('ml.passFail')}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('ml.dataPoints')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{analytics.total_students}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

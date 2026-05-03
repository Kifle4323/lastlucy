export class GradeCalculator {
  static GRADE_POINTS = {
    'A+': { min: 90, max: 100, point: 4.0, letter: 'A+' },
    'A': { min: 85, max: 89, point: 4.0, letter: 'A' },
    'A-': { min: 80, max: 84, point: 3.75, letter: 'A-' },
    'B+': { min: 75, max: 79, point: 3.5, letter: 'B+' },
    'B': { min: 70, max: 74, point: 3.0, letter: 'B' },
    'B-': { min: 65, max: 69, point: 2.75, letter: 'B-' },
    'C+': { min: 60, max: 64, point: 2.5, letter: 'C+' },
    'C': { min: 50, max: 59, point: 2.0, letter: 'C' },
    'C-': { min: 45, max: 49, point: 1.75, letter: 'C-' },
    'D': { min: 40, max: 44, point: 1.0, letter: 'D' },
    'F': { min: 0, max: 39, point: 0.0, letter: 'F' },
  };

  static letterToEnum(letter) {
    const map = {
      'A+': 'A_PLUS', 'A-': 'A_MINUS',
      'B+': 'B_PLUS', 'B-': 'B_MINUS',
      'C+': 'C_PLUS', 'C-': 'C_MINUS',
      'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'F': 'F',
    };
    return map[letter] || letter;
  }

  static getGradeFromScore(score) {
    for (const [, data] of Object.entries(this.GRADE_POINTS)) {
      if (score >= data.min && score <= data.max) {
        return { letter: data.letter, point: data.point };
      }
    }
    return { letter: 'F', point: 0.0 };
  }
}

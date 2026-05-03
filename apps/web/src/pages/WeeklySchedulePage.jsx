import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { getMyWeeklySchedule, getTeacherWeeklySchedule } from '../api';
import Layout from '../components/Layout';
import { Calendar, Clock, MapPin, Monitor, User, BookOpen, AlertCircle } from 'lucide-react';

export default function WeeklySchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);

  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const dayLabels = {
    MONDAY: t('schedule.monday', 'Monday'),
    TUESDAY: t('schedule.tuesday', 'Tuesday'),
    WEDNESDAY: t('schedule.wednesday', 'Wednesday'),
    THURSDAY: t('schedule.thursday', 'Thursday'),
    FRIDAY: t('schedule.friday', 'Friday'),
    SATURDAY: t('schedule.saturday', 'Saturday'),
    SUNDAY: t('schedule.sunday', 'Sunday'),
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      const data = user?.role === 'STUDENT'
        ? await getMyWeeklySchedule()
        : await getTeacherWeeklySchedule();
      setScheduleData(data);
    } catch (err) {
      toast.error(err.message || t('schedule.loadError', 'Failed to load schedule'));
    } finally {
      setLoading(false);
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  }

  function getScheduleForDay(day) {
    if (!scheduleData?.schedule) return [];
    return scheduleData.schedule.filter(item => item.dayOfWeek === day);
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center">{t('common.loading')}</div>
      </Layout>
    );
  }

  const hasSchedule = scheduleData?.schedule && scheduleData.schedule.length > 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            {t('schedule.title', 'Weekly Schedule')}
          </h1>
          {scheduleData?.semester && (
            <p className="text-gray-500 mt-1">
              {scheduleData.semester.name}
            </p>
          )}
        </div>

        {!hasSchedule ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('schedule.noSchedule', 'No schedule available')}
            </h3>
            <p className="text-gray-500">
              {t('schedule.noScheduleDesc', 'Your courses do not have scheduled times yet. Please contact the admin.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {days.map(day => {
              const daySchedule = getScheduleForDay(day);
              const hasItems = daySchedule.length > 0;

              return (
                <div key={day} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className={`p-3 font-semibold text-center ${hasItems ? 'bg-primary-50 text-primary-800' : 'bg-gray-50 text-gray-500'}`}>
                    {dayLabels[day]}
                  </div>
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {daySchedule.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm py-8">
                        {t('schedule.noClasses', 'No classes')}
                      </div>
                    ) : (
                      daySchedule.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className={`p-3 rounded-lg text-sm ${item.isOnline ? 'bg-blue-50 border border-blue-100' : 'bg-green-50 border border-green-100'}`}
                        >
                          <div className="font-medium text-gray-900 mb-1">
                            {item.courseTitle}
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            {item.courseCode}
                          </div>

                          {item.startTime && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            {item.isOnline ? (
                              <>
                                <Monitor className="w-3 h-3 text-blue-500" />
                                <span className="text-blue-600">{t('schedule.online', 'Online')}</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="w-3 h-3 text-green-500" />
                                <span className="text-green-600">{item.room || t('schedule.tbd', 'TBD')}</span>
                              </>
                            )}
                          </div>

                          {user?.role === 'STUDENT' && item.teacherName && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <User className="w-3 h-3" />
                              <span>{item.teacherName}</span>
                            </div>
                          )}

                          {user?.role === 'TEACHER' && item.className && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <BookOpen className="w-3 h-3" />
                              <span>{item.className}</span>
                            </div>
                          )}

                          {item.legacySchedule && (
                            <div className="mt-2 text-xs text-gray-500 italic">
                              {item.legacySchedule}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border border-blue-100 rounded"></div>
            <span>{t('schedule.onlineClass', 'Online Class')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-100 rounded"></div>
            <span>{t('schedule.inPersonClass', 'In-Person Class')}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}

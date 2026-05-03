import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { getAllStudentProfiles, approveStudentProfile, rejectStudentProfile, generateCertificate, getStudentGraduationStatus } from '../api';
import Layout from '../components/Layout';
import { 
  User, Clock, CheckCircle, XCircle, Search, Eye, X, 
  FileText, MapPin, GraduationCap, AlertCircle, ChevronDown, ChevronUp,
  ExternalLink, Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AdminStudentProfilesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);

  useEffect(() => {
    loadProfiles();
  }, [statusFilter]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await getAllStudentProfiles(statusFilter);
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (profileId) => {
    setProcessing(true);
    try {
      await approveStudentProfile(profileId);
      setProfiles(profiles.filter(p => p.id !== profileId));
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(null);
      }
    } catch (err) {
      toast.error(t('admin.failedApproveProfile'));
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateCertificate = async (studentId) => {
    setProcessing(true);
    try {
      const cert = await generateCertificate(studentId);
      toast.success(t('admin.certificateGenerated', { number: cert.certificateNumber }));
      setSelectedProfile(null);
      loadProfiles();
    } catch (err) {
      toast.error(err.message || t('admin.failedGenerateCertificate'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.warning(t('admin.provideRejectionReason'));
      return;
    }
    setProcessing(true);
    try {
      await rejectStudentProfile(selectedProfile.id, rejectionReason);
      setProfiles(profiles.filter(p => p.id !== selectedProfile.id));
      setShowRejectModal(false);
      setSelectedProfile(null);
      setRejectionReason('');
    } catch (err) {
      toast.error(t('admin.failedRejectProfile'));
    } finally {
      setProcessing(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.user?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    p.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.firstName?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">{t('studentProfile.draft')}</span>;
      case 'PENDING_APPROVAL':
        return <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> {t('reports.pending')}</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('studentProfile.approved')}</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> {t('reports.rejected')}</span>;
      default:
        return null;
    }
  };

  if (user?.role !== 'ADMIN') return <div className="p-8 text-center">{t('common.accessDenied')}</div>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.studentProfiles')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('admin.reviewApproveProfiles')}</p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.searchByNameOrEmail')}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="PENDING_APPROVAL">{t('admin.pendingApproval')}</option>
              <option value="APPROVED">{t('studentProfile.approved')}</option>
              <option value="REJECTED">{t('reports.rejected')}</option>
              <option value="DRAFT">{t('studentProfile.draft')}</option>
              <option value="">{t('common.all')}</option>
            </select>
          </div>
        </div>

        {/* Profiles List */}
        {loading ? (
          <div className="p-8 text-center">{t('common.loading')}</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            {t('admin.noProfilesFound')}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('gradebook.student')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('common.status')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('admin.updated')}</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProfiles.map(profile => (
                  <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {profile.user?.profileImage ? (
                          <img src={profile.user.profileImage} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                            <span className="text-primary-700 dark:text-primary-300 font-semibold">
                              {profile.user?.fullName?.charAt(0) || profile.firstName?.charAt(0) || 'S'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{profile.user?.fullName || `${profile.firstName} ${profile.fatherName}`}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{profile.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(profile.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(profile.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedProfile(profile)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-gray-500 dark:text-gray-300"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Profile Detail Modal */}
        {selectedProfile && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedProfile.user?.profileImage ? (
                    <img src={selectedProfile.user.profileImage} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary-700 dark:text-primary-300" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedProfile.user?.fullName || `${selectedProfile.firstName} ${selectedProfile.fatherName}`}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedProfile.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedProfile.status)}
                  <button onClick={() => setSelectedProfile(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <X className="w-5 h-5 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Personal Information */}
                <Section title={t('admin.personalInformation')} icon={User}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label={t('admin.firstName')} value={selectedProfile.firstName} />
                    <Field label={t('admin.fatherName')} value={selectedProfile.fatherName} />
                    <Field label={t('admin.grandfatherName')} value={selectedProfile.grandFatherName} />
                    <Field label={t('admin.firstNameAmharic')} value={selectedProfile.firstNameLocal} />
                    <Field label={t('admin.fatherNameAmharic')} value={selectedProfile.fatherNameLocal} />
                    <Field label={t('admin.grandfatherNameAmharic')} value={selectedProfile.grandFatherNameLocal} />
                    <Field label={t('admin.dateOfBirthGC')} value={selectedProfile.dateOfBirthGC ? new Date(selectedProfile.dateOfBirthGC).toLocaleDateString() : null} />
                    <Field label={t('admin.gender')} value={selectedProfile.gender} />
                    <Field label={t('admin.placeOfBirth')} value={selectedProfile.placeOfBirth} />
                    <Field label={t('admin.motherTongue')} value={selectedProfile.motherTongue} />
                    <Field label={t('admin.healthStatus')} value={selectedProfile.healthStatus} />
                    <Field label={t('admin.maritalStatus')} value={selectedProfile.maritalStatus} />
                    <Field label={t('admin.nationalIdFan')} value={selectedProfile.nationalIdFan} />
                    <Field label={t('admin.economicalStatus')} value={selectedProfile.economicalStatus} />
                    <Field label={t('admin.areaType')} value={selectedProfile.areaType} />
                    <Field label={t('admin.tinNumber')} value={selectedProfile.tinNumber} />
                    <Field label={t('admin.accountNumber')} value={selectedProfile.accountNumber} />
                  </div>
                </Section>

                {/* Location and Address */}
                <Section title={t('admin.locationAndAddress')} icon={MapPin}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label={t('admin.citizenship')} value={selectedProfile.citizenship} />
                    <Field label={t('admin.country')} value={selectedProfile.country} />
                    <Field label={t('admin.city')} value={selectedProfile.city} />
                    <Field label={t('admin.subCity')} value={selectedProfile.subCity} />
                    <Field label={t('admin.kebele')} value={selectedProfile.kebele} />
                    <Field label={t('admin.woreda')} value={selectedProfile.woreda} />
                    <Field label={t('admin.houseNumber')} value={selectedProfile.houseNumber} />
                    <Field label={t('common.phone')} value={selectedProfile.phone} />
                    <Field label={t('common.email')} value={selectedProfile.email} />
                    <Field label={t('admin.poBox')} value={selectedProfile.pobox} />
                  </div>
                </Section>

                {/* Educational Information */}
                <Section title={t('admin.educationalInformation')} icon={GraduationCap}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label={t('admin.stream')} value={selectedProfile.stream} />
                    <Field label={t('admin.entryYear')} value={selectedProfile.entryYear} />
                    <Field label={t('admin.sponsorCategory')} value={selectedProfile.sponsorCategory} />
                    <Field label={t('admin.sponsoredBy')} value={selectedProfile.sponsoredBy} />
                    <Field label={t('admin.nationalExamYearEC')} value={selectedProfile.nationalExamYearEC} />
                    <Field label={t('admin.examinationId')} value={selectedProfile.examinationId} />
                    <Field label={t('admin.admissionDate')} value={selectedProfile.admissionDate ? new Date(selectedProfile.admissionDate).toLocaleDateString() : null} />
                    <Field label={t('admin.checkedInDate')} value={selectedProfile.checkedInDate ? new Date(selectedProfile.checkedInDate).toLocaleDateString() : null} />
                    <Field label={t('admin.nationalExamResultTotal')} value={selectedProfile.nationalExamResultTotal} />
                  </div>

                  <h4 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">{t('admin.nationalExamSubjectResults')}</h4>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {(selectedProfile.stream === 'Social Science' ? [
                      { label: 'English', value: selectedProfile.examEnglish },
                      { label: 'Civics', value: selectedProfile.examCivics },
                      { label: 'History', value: selectedProfile.examHistory },
                      { label: 'Economics', value: selectedProfile.examEconomics },
                      { label: 'Geography', value: selectedProfile.examGeography },
                      { label: 'Social Math', value: selectedProfile.examSocialMath },
                      { label: 'Aptitude', value: selectedProfile.examAptitude },
                    ] : [
                      { label: 'English', value: selectedProfile.examEnglish },
                      { label: 'Physics', value: selectedProfile.examPhysics },
                      { label: 'Civics', value: selectedProfile.examCivics },
                      { label: 'Natural Math', value: selectedProfile.examNaturalMath },
                      { label: 'Chemistry', value: selectedProfile.examChemistry },
                      { label: 'Biology', value: selectedProfile.examBiology },
                      { label: 'Aptitude', value: selectedProfile.examAptitude },
                    ]).map(item => (
                      <div key={item.label} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="font-bold text-gray-900 dark:text-white">{item.value || '-'}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Documents */}
                <Section title={t('admin.documents')} icon={FileText}>
                  {selectedProfile.documents?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedProfile.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{doc.documentType}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{doc.fileName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreviewDocument(doc)}
                              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-primary-600 dark:text-primary-400"
                              title="Preview document"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${doc.status === 'SUBMITTED' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'}`}>
                              {doc.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">{t('admin.noDocumentsUploaded')}</p>
                  )}
                </Section>

                {/* Rejection Reason */}
                {selectedProfile.status === 'REJECTED' && selectedProfile.rejectionReason && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-700 dark:text-red-400 font-medium">{t('admin.rejectionReason')}:</p>
                    <p className="text-red-600 dark:text-red-300">{selectedProfile.rejectionReason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedProfile.status === 'PENDING_APPROVAL' && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleApprove(selectedProfile.id)}
                      disabled={processing}
                      className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {t('faceVerification.approve')}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={processing}
                      className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      {t('reports.rejected')}
                    </button>
                  </div>
                )}

                {/* Generate Certificate & Transcript */}
                {selectedProfile.status === 'APPROVED' && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <Link
                      to={`/admin/students/${selectedProfile.userId}/transcript?admin=1`}
                      className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      {t('results.viewTranscript')}
                    </Link>
                    <button
                      onClick={() => handleGenerateCertificate(selectedProfile.userId)}
                      disabled={processing}
                      className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <GraduationCap className="w-5 h-5" />
                      {t('admin.generateCertificate')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black/75 z-[60] flex flex-col">
            <div className="bg-white dark:bg-gray-800 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{previewDocument.documentType}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{previewDocument.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDocument.fileUrl}
                  download={previewDocument.fileName || 'document'}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                  title={t('common.download')}
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setPreviewDocument(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {previewDocument.fileUrl?.startsWith('data:image') ? (
                <img
                  src={previewDocument.fileUrl}
                  alt={previewDocument.documentType}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              ) : previewDocument.fileUrl?.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDocument.fileUrl}
                  className="w-full h-full rounded-lg bg-white"
                  title="Document Preview"
                />
              ) : (
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">{t('admin.previewNotAvailable')}</p>
                  <a
                    href={previewDocument.fileUrl}
                    download={previewDocument.fileName || 'document'}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    {t('common.download')} {t('admin.file')}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('admin.rejectProfile')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{t('admin.provideRejectionReason')}:</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={t('admin.enterRejectionReason')}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white font-medium rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {processing ? t('admin.rejecting') : t('reports.rejected')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Section({ title, icon: Icon, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
      >
        <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
          <Icon className="w-5 h-5" />
          {title}
        </span>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">{value || '-'}</p>
    </div>
  );
}

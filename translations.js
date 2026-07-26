/**
 * Bilingual translations module (English / Khmer)
 * Provides all UI labels for the Cambodia Vision Patient Management System.
 */

const translations = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', km: 'ផ្ទាំងគ្រប់គ្រង' },
  'nav.registration': { en: 'Registration', km: 'ការចុះឈ្មោះ' },
  'nav.data_report': { en: 'Data Report', km: 'របាយការណ៍ទិន្នន័យ' },
  'nav.gp_examination': { en: 'GP Examination', km: 'ការពិនិត្យវេជ្ជបណ្ឌិត' },
  'nav.surgery': { en: 'Surgery', km: 'វះកាត់' },
  'nav.admin': { en: 'Admin', km: 'អ្នកគ្រប់គ្រង' },
  'nav.login': { en: 'Login', km: 'ចូល' },
  'nav.logout': { en: 'Logout', km: 'ចាកចេញ' },

  // Form labels — Patient registration
  'form.patient_number': { en: 'Patient Number', km: 'លេខអ្នកជំងឺ' },
  'form.family_name': { en: 'Family Name', km: 'នាមត្រកូល' },
  'form.given_name': { en: 'Given Name', km: 'នាមខ្លួន' },
  'form.age': { en: 'Age', km: 'អាយុ' },
  'form.gender': { en: 'Gender', km: 'ភេទ' },
  'form.phone': { en: 'Phone', km: 'ទូរសព្ទ' },
  'form.contact_phone': { en: 'Contact Phone', km: 'លេខទូរសព្ទ' },
  'form.province': { en: 'Province', km: 'ខេត្ត' },
  'form.district': { en: 'District', km: 'ស្រុក' },
  'form.village': { en: 'Village', km: 'ភូមិ' },
  'form.commune': { en: 'Commune', km: 'ឃុំ' },
  'form.reason_for_visit': { en: 'Reason for Visit', km: 'មូលហេតុមកពិនិត្យ' },
  'form.blood_group': { en: 'Blood Group', km: 'ប្រភេទឈាម' },
  'form.is_pregnant': { en: 'Is Pregnant', km: 'មានផ្ទៃពោះ' },
  'form.has_tb': { en: 'Has TB', km: 'មានជំងឺរបេង' },
  'form.photo': { en: 'Photo', km: 'រូបថត' },

  // GP examination form labels
  'form.visual_acuity_left': { en: 'Visual Acuity Left', km: 'សុខភាពភ្នែកឆ្វេង' },
  'form.visual_acuity_right': { en: 'Visual Acuity Right', km: 'សុខភាពភ្នែកស្ដាំ' },
  'form.diagnosis_notes': { en: 'Diagnosis Notes', km: 'កំណត់ត្រារោគវិនិច្ឆ័យ' },
  'form.recommendation': { en: 'Recommendation', km: 'អនុសាសន៍' },

  // Surgery form labels
  'form.eligibility': { en: 'Eligibility', km: 'សិទ្ធិទទួលការវះកាត់' },
  'form.surgery_type': { en: 'Surgery Type', km: 'ប្រភេទវះកាត់' },
  'form.eye': { en: 'Eye', km: 'ភ្នែក' },
  'form.scheduled_date': { en: 'Scheduled Date', km: 'កាលបរិច្ឆេទកំណត់' },
  'form.reason_ineligibility': { en: 'Reason for Ineligibility', km: 'មូលហេតុមិនមានសិទ្ធិ' },
  'form.reason_not_eligible': { en: 'Reason Not Eligible', km: 'មូលហេតុមិនមានសិទ្ធិវះកាត់' },

  // Buttons
  'button.submit': { en: 'Submit', km: 'ដាក់ស្នើ' },
  'button.save': { en: 'Save', km: 'រក្សាទុក' },
  'button.cancel': { en: 'Cancel', km: 'បោះបង់' },
  'button.export_pdf': { en: 'Export PDF', km: 'នាំចេញ PDF' },
  'button.login': { en: 'Login', km: 'ចូល' },
  'button.logout': { en: 'Logout', km: 'ចាកចេញ' },
  'button.search': { en: 'Search', km: 'ស្វែងរក' },
  'button.filter': { en: 'Filter', km: 'តម្រង' },
  'button.clear': { en: 'Clear', km: 'សម្អាត' },

  // Status names
  'status.registered': { en: 'Registered', km: 'បានចុះឈ្មោះ' },
  'status.seen_by_gp': { en: 'Seen by GP', km: 'បានពិនិត្យដោយវេជ្ជបណ្ឌិត' },
  'status.surgery_eligible': { en: 'Surgery Eligible', km: 'មានសិទ្ធិវះកាត់' },
  'status.not_eligible': { en: 'Not Eligible', km: 'គ្មានសិទ្ធិវះកាត់' },
  'status.surgery_scheduled': { en: 'Surgery Scheduled', km: 'កំណត់កាលវះកាត់' },
  'status.complete': { en: 'Complete', km: 'បញ្ចប់' },

  // Validation messages
  'validation.required': { en: 'Required', km: 'ត្រូវការ' },
  'validation.invalid_credentials': { en: 'Invalid credentials', km: 'ព័ត៌មានសម្គាល់មិនត្រឹមត្រូវ' },
  'validation.rate_limited': { en: 'Too many login attempts. Please wait before retrying.', km: 'ព្យាយាមចូលច្រើនពេក។ សូមរង់ចាំមុននឹងព្យាយាមម្ដងទៀត។' },
  'validation.too_many_attempts': { en: 'Too many attempts', km: 'ព្យាយាមច្រើនពេក' },
  'validation.invalid_transition': { en: 'Invalid status transition', km: 'ការផ្លាស់ប្ដូរស្ថានភាពមិនត្រឹមត្រូវ' },

  // Common labels
  'common.yes': { en: 'Yes', km: 'បាទ/ចាស' },
  'common.no': { en: 'No', km: 'ទេ' },
  'common.male': { en: 'Male', km: 'ប្រុស' },
  'common.female': { en: 'Female', km: 'ស្រី' },
  'common.child': { en: 'Child', km: 'កុមារ' },
  'common.left': { en: 'Left', km: 'ឆ្វេង' },
  'common.right': { en: 'Right', km: 'ស្ដាំ' },
  'common.both': { en: 'Both', km: 'ទាំងពីរ' },

  // Admin panel
  'admin.title': { en: 'Admin Panel', km: 'ផ្ទាំងគ្រប់គ្រង' },
  'admin.users': { en: 'Admin Users', km: 'អ្នកប្រើប្រាស់ Admin' },
  'admin.add_user': { en: 'Add User', km: 'បន្ថែមអ្នកប្រើប្រាស់' },
  'admin.username': { en: 'Username', km: 'ឈ្មោះអ្នកប្រើ' },
  'admin.password': { en: 'Password', km: 'ពាក្យសម្ងាត់' },
  'admin.full_name': { en: 'Full Name', km: 'ឈ្មោះពេញ' },
  'admin.created_at': { en: 'Created', km: 'បង្កើតនៅ' },
  'admin.actions': { en: 'Actions', km: 'សកម្មភាព' },
  'admin.delete': { en: 'Delete', km: 'លុប' },
  'admin.change_passphrase': { en: 'Change Shared Passphrase', km: 'ផ្លាស់ប្ដូរឃ្លាសម្ងាត់រួម' },
  'admin.new_passphrase': { en: 'New Passphrase', km: 'ឃ្លាសម្ងាត់ថ្មី' },
  'admin.update': { en: 'Update', km: 'ធ្វើបច្ចុប្បន្នភាព' },
  'admin.no_users': { en: 'No admin users found', km: 'រកមិនឃើញអ្នកប្រើប្រាស់ Admin' },
  'admin.confirm_delete': { en: 'Are you sure you want to delete this user?', km: 'តើអ្នកប្រាកដថាចង់លុបអ្នកប្រើប្រាស់នេះ?' },

  // General UI
  'ui.patient': { en: 'Patient', km: 'អ្នកជំងឺ' },
  'ui.patients': { en: 'Patients', km: 'អ្នកជំងឺទាំងអស់' },
  'ui.status': { en: 'Status', km: 'ស្ថានភាព' },
  'ui.actions': { en: 'Actions', km: 'សកម្មភាព' },
  'ui.date': { en: 'Date', km: 'កាលបរិច្ឆេទ' },
  'ui.no_results': { en: 'No results found', km: 'រកមិនឃើញលទ្ធផល' },
  'ui.total_registrations': { en: 'Total Registrations', km: 'ការចុះឈ្មោះសរុប' },
  'ui.male_patients': { en: 'Male Patients', km: 'អ្នកជំងឺប្រុស' },
  'ui.female_patients': { en: 'Female Patients', km: 'អ្នកជំងឺស្រី' },
  'ui.child_patients': { en: 'Child Patients', km: 'អ្នកជំងឺកុមារ' },
  'ui.anaesthesia_treatments': { en: 'Anaesthesia Treatments', km: 'ការព្យាបាលផ្គុំថ្នាំសន្លប់' },
  'ui.surgery_treatments': { en: 'Surgery Treatments', km: 'ការព្យាបាលវះកាត់' },
  'ui.daily_treatments': { en: 'Daily Treatments', km: 'ការព្យាបាលប្រចាំថ្ងៃ' },
  'ui.summary': { en: 'Summary', km: 'សង្ខេប' },
  'ui.refresh': { en: 'Refresh', km: 'ផ្ទុកឡើងវិញ' },
};

/**
 * Get a translation entry by key.
 * @param {string} key - Translation key (e.g. 'form.family_name')
 * @returns {{ en: string, km: string }} Translation object with English and Khmer values
 */
export function t(key) {
  const entry = translations[key];
  if (!entry) return { en: key, km: key };
  return entry;
}

export default translations;

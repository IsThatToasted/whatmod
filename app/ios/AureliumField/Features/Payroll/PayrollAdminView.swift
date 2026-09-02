import SwiftUI

private struct PayrollSettingsRecord: Codable {
    var organizationID: UUID
    var payPeriodType: String
    var weekStart: Int
    var weekEnd: Int
    var biweeklyAnchor: String
    var overtimeThresholdHours: Double

    enum CodingKeys: String, CodingKey {
        case organizationID = "organization_id"
        case payPeriodType = "pay_period_type"
        case weekStart = "week_start"
        case weekEnd = "week_end"
        case biweeklyAnchor = "biweekly_anchor"
        case overtimeThresholdHours = "overtime_threshold_hours"
    }
}

private struct EmployeePayrollProfile: Codable, Identifiable {
    var organizationID: UUID
    var userID: UUID
    var displayName: String?
    var legalFirstName: String?
    var legalMiddleName: String?
    var legalLastName: String?
    var positionTitle: String?
    var phone: String?
    var email: String?
    var streetAddress: String?
    var addressLine2: String?
    var city: String?
    var state: String?
    var postalCode: String?
    var country: String?
    var employmentStatus: String
    var hireDate: String?
    var employeeNumber: String?
    var payClassification: String
    var hourlyRate: Double?
    var overtimeEligible: Bool
    var standardWeeklyHours: Double
    var department: String?
    var emergencyContactName: String?
    var emergencyContactPhone: String?
    var id: UUID { userID }

    enum CodingKeys: String, CodingKey {
        case organizationID = "organization_id"
        case userID = "user_id"
        case displayName = "display_name"
        case legalFirstName = "legal_first_name"
        case legalMiddleName = "legal_middle_name"
        case legalLastName = "legal_last_name"
        case positionTitle = "position_title"
        case phone, email
        case streetAddress = "street_address"
        case addressLine2 = "address_line_2"
        case city, state
        case postalCode = "postal_code"
        case country
        case employmentStatus = "employment_status"
        case hireDate = "hire_date"
        case employeeNumber = "employee_number"
        case payClassification = "pay_classification"
        case hourlyRate = "hourly_rate"
        case overtimeEligible = "overtime_eligible"
        case standardWeeklyHours = "standard_weekly_hours"
        case department
        case emergencyContactName = "emergency_contact_name"
        case emergencyContactPhone = "emergency_contact_phone"
    }
}

struct PayrollAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var cloud = WorkspaceService.shared
    @State private var members: [AdminOrganizationMember] = []
    @State private var profiles: [UUID: EmployeePayrollProfile] = [:]
    @State private var settings: PayrollSettingsRecord?
    @State private var editing: AdminOrganizationMember?
    @State private var errorReference: String?
    private let weekdays = Calendar.current.weekdaySymbols

    var body: some View {
        List {
            if let errorReference {
                Section { Text("Payroll could not update. Reference: \(errorReference)").foregroundStyle(.secondary) }
            }
            Section("Current pay period") {
                if let range = currentPeriod {
                    LabeledContent("Period", value: "\(range.0.formatted(date: .abbreviated, time: .omitted)) – \(range.1.formatted(date: .abbreviated, time: .omitted))")
                }
                LabeledContent("Employees", value: "\(members.filter(\.active).count)")
                Text("Approved and submitted hours continue to use the existing audited timecard workflow.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Section("Payroll settings") {
                Picker("Pay period", selection: Binding(get: { settings?.payPeriodType ?? "weekly" }, set: { settings?.payPeriodType = $0 })) {
                    Text("Weekly").tag("weekly")
                    Text("Biweekly").tag("biweekly")
                }
                Picker("Week starts", selection: Binding(get: { settings?.weekStart ?? 1 }, set: { settings?.weekStart = $0 })) {
                    ForEach(0..<7, id: \.self) { Text(weekdays[$0]).tag($0) }
                }
                Picker("Week ends", selection: Binding(get: { settings?.weekEnd ?? 0 }, set: { settings?.weekEnd = $0 })) {
                    ForEach(0..<7, id: \.self) { Text(weekdays[$0]).tag($0) }
                }
                Button("Save Payroll Settings") { Task { await saveSettings() } }
            }
            Section("Employee profiles") {
                ForEach(members.filter(\.active)) { member in
                    Button { editing = member } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(profiles[member.userID]?.displayName ?? member.displayName ?? member.email ?? "Employee").font(.headline)
                                Text(profiles[member.userID]?.positionTitle ?? member.role.capitalized).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                    }.buttonStyle(.plain)
                }
            }
            Section {
                Text("Aurelium intentionally does not store SSNs, tax IDs, or bank credentials in general employee profile records.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Payroll")
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Employee View") { model.workspaceMode = .employee } } }
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $editing) { member in
            EmployeePayrollEditor(member: member, existing: profiles[member.userID]) { await load() }
        }
    }

    private var currentPeriod: (Date, Date)? {
        guard let settings else { return nil }
        let calendar = Calendar.current
        let now = Date()
        let weekday = calendar.component(.weekday, from: now) - 1
        let delta = (weekday - settings.weekStart + 7) % 7
        var start = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -delta, to: now) ?? now)
        if settings.payPeriodType == "biweekly", let anchor = payrollDayFormatter.date(from: settings.biweeklyAnchor) {
            let anchorDay = calendar.startOfDay(for: anchor)
            let days = calendar.dateComponents([.day], from: anchorDay, to: start).day ?? 0
            start = calendar.date(byAdding: .day, value: (days / 14) * 14, to: anchorDay) ?? start
        }
        let end = calendar.date(byAdding: .day, value: settings.payPeriodType == "biweekly" ? 13 : 6, to: start) ?? start
        return (start, end)
    }

    private func load() async {
        guard let org = cloud.organizationID else { return }
        do {
            members = try await cloud.fetchAdminMembers()
            let rows: [EmployeePayrollProfile] = try await cloud.selectRows(table: "employee_profiles", filters: [CloudFilter("organization_id", org.uuidString)])
            profiles = rows.reduce(into: [:]) { $0[$1.userID] = $1 }
            let settingRows: [PayrollSettingsRecord] = try await cloud.selectRows(table: "payroll_settings", filters: [CloudFilter("organization_id", org.uuidString)], limit: 1)
            settings = settingRows.first ?? PayrollSettingsRecord(organizationID: org, payPeriodType: "weekly", weekStart: 1, weekEnd: 0, biweeklyAnchor: payrollDayFormatter.string(from: .now), overtimeThresholdHours: 40)
        } catch {
            errorReference = "AF-PAY-201"
        }
    }

    private func saveSettings() async {
        guard let settings else { return }
        do {
            try await cloud.upsertRecord(table: "payroll_settings", payload: settings, onConflict: "organization_id")
            await load()
        } catch { errorReference = "AF-PAY-202" }
    }
}

private struct EmployeePayrollEditor: View {
    let member: AdminOrganizationMember
    let existing: EmployeePayrollProfile?
    let onSaved: () async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var profile: EmployeePayrollProfile
    private let cloud = WorkspaceService.shared

    init(member: AdminOrganizationMember, existing: EmployeePayrollProfile?, onSaved: @escaping () async -> Void) {
        self.member = member
        self.existing = existing
        self.onSaved = onSaved
        let org = WorkspaceService.shared.organizationID ?? UUID()
        _profile = State(initialValue: existing ?? EmployeePayrollProfile(
            organizationID: org, userID: member.userID, displayName: member.displayName,
            legalFirstName: nil, legalMiddleName: nil, legalLastName: nil, positionTitle: nil,
            phone: member.phone, email: member.email, streetAddress: nil, addressLine2: nil,
            city: nil, state: nil, postalCode: nil, country: "US", employmentStatus: "active",
            hireDate: nil, employeeNumber: nil, payClassification: "hourly", hourlyRate: nil,
            overtimeEligible: true, standardWeeklyHours: 40, department: nil,
            emergencyContactName: nil, emergencyContactPhone: nil
        ))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Display name", text: optionalText($profile.displayName))
                    TextField("Legal first name", text: optionalText($profile.legalFirstName))
                    TextField("Legal middle name", text: optionalText($profile.legalMiddleName))
                    TextField("Legal last name", text: optionalText($profile.legalLastName))
                    TextField("Position / job title", text: optionalText($profile.positionTitle))
                    TextField("Employee number", text: optionalText($profile.employeeNumber))
                    TextField("Department", text: optionalText($profile.department))
                }
                Section("Contact") {
                    TextField("Phone", text: optionalText($profile.phone))
                    TextField("Email", text: optionalText($profile.email)).textInputAutocapitalization(.never)
                    TextField("Street address", text: optionalText($profile.streetAddress))
                    TextField("Address line 2", text: optionalText($profile.addressLine2))
                    TextField("City", text: optionalText($profile.city))
                    TextField("State", text: optionalText($profile.state))
                    TextField("Postal code", text: optionalText($profile.postalCode))
                    TextField("Country", text: optionalText($profile.country))
                }
                Section("Payroll classification") {
                    Picker("Classification", selection: $profile.payClassification) {
                        Text("Hourly").tag("hourly")
                        Text("Salary").tag("salary")
                    }
                    TextField("Hourly rate", text: optionalDoubleText($profile.hourlyRate)).keyboardType(.decimalPad)
                    Toggle("Overtime eligible", isOn: $profile.overtimeEligible)
                    TextField("Standard weekly hours", value: $profile.standardWeeklyHours, format: .number).keyboardType(.decimalPad)
                }
                Section("Emergency contact") {
                    TextField("Name", text: optionalText($profile.emergencyContactName))
                    TextField("Phone", text: optionalText($profile.emergencyContactPhone))
                }
                Section {
                    Text("SSNs, tax IDs and banking credentials are excluded from this profile.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Employee Details")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } } }
            }
        }
    }

    private func save() async {
        do {
            try await cloud.upsertRecord(table: "employee_profiles", payload: profile, onConflict: "organization_id,user_id")
            await onSaved()
            dismiss()
        } catch { }
    }
}

private func optionalText(_ binding: Binding<String?>) -> Binding<String> {
    Binding(get: { binding.wrappedValue ?? "" }, set: { binding.wrappedValue = $0.isEmpty ? nil : $0 })
}

private func optionalDoubleText(_ binding: Binding<Double?>) -> Binding<String> {
    Binding(
        get: { binding.wrappedValue.map { String(format: "%.2f", $0) } ?? "" },
        set: { binding.wrappedValue = Double($0) }
    )
}

private let payrollDayFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
}()

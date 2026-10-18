import SwiftUI
import Observation
import UIKit

private enum AdminTab: Hashable { case overview, estimates, timecards, payroll, employees, invites }

struct AdminWorkspaceView: View {
    @Environment(AppModel.self) private var model
    @State private var store = AdminWorkspaceStore()
    @State private var selectedTab: AdminTab = .overview

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { AdminDashboardView(selectedTab: $selectedTab) }
                .tabItem { Label("Overview", systemImage: "rectangle.3.group") }
                .tag(AdminTab.overview)
            NavigationStack { AdminEstimatesView() }
                .tabItem { Label("Estimates", systemImage: "doc.text.magnifyingglass") }
                .badge(store.pendingEstimateCount)
                .tag(AdminTab.estimates)
            NavigationStack { AdminTimecardsView() }
                .tabItem { Label("Timecards", systemImage: "clock.badge.checkmark") }
                .badge(store.pendingReviewCount)
                .tag(AdminTab.timecards)
            NavigationStack { PayrollAdminView() }
                .tabItem { Label("Payroll", systemImage: "dollarsign.circle") }
                .tag(AdminTab.payroll)
            NavigationStack { AdminEmployeesView() }
                .tabItem { Label("Employees", systemImage: "person.3") }
                .tag(AdminTab.employees)
            NavigationStack { AdminInvitesView() }
                .tabItem { Label("Invites", systemImage: "person.badge.plus") }
                .tag(AdminTab.invites)
        }
        .environment(store)
        .tint(.primary)
        .task { await store.load() }
        .alert("Admin workspace", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(store.errorMessage ?? "") }
    }
}

@MainActor @Observable
private final class AdminWorkspaceStore {
    var members: [AdminOrganizationMember] = []
    var timecards: [TimeEntryRecord] = []
    var editRequests: [AdminTimeEditRequest] = []
    var invites: [OrganizationInviteRecord] = []
    var estimatePackets: [AdminEstimatePacket] = []
    var isLoading = false
    var errorMessage: String?

    private var cloud: WorkspaceService { .shared }

    var submittedTimecards: [TimeEntryRecord] { timecards.filter { $0.status == "submitted" } }
    var reviewedTimecards: [TimeEntryRecord] { timecards.filter { ["approved", "rejected"].contains($0.status) } }
    var otherTimecards: [TimeEntryRecord] { timecards.filter { !["submitted", "approved", "rejected"].contains($0.status) } }
    var pendingReviewCount: Int { submittedTimecards.count + editRequests.count }
    var pendingEstimateCount: Int { estimatePackets.filter { ["submitted", "in_review"].contains($0.status) }.count }
    var activeMemberCount: Int { members.filter(\.active).count }
    var openInviteCount: Int { invites.filter { $0.acceptedAt == nil && $0.revokedAt == nil && $0.expiresAt > .now }.count }

    func name(for userID: UUID) -> String {
        guard let member = members.first(where: { $0.userID == userID }) else { return "Employee" }
        return member.displayName ?? member.email ?? "Employee"
    }

    func load() async {
        guard cloud.isAdmin else {
            errorMessage = "Admin access is required."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            members = try await cloud.fetchAdminMembers()
            timecards = try await cloud.fetchAdminTimeEntries()
            editRequests = try await cloud.fetchPendingTimeEditRequests()
            invites = try await cloud.fetchOrganizationInvites()
            estimatePackets = try await EstimateAdminService.shared.fetchPackets()
        } catch { errorMessage = error.localizedDescription }
    }

    func approve(_ entry: TimeEntryRecord) async { await decide(entry, approve: true, note: nil) }
    func reject(_ entry: TimeEntryRecord, note: String?) async { await decide(entry, approve: false, note: note) }

    private func decide(_ entry: TimeEntryRecord, approve: Bool, note: String?) async {
        do {
            try await cloud.decideAdminTimeEntry(id: entry.id, approve: approve, note: note)
            await load()
        } catch { errorMessage = error.localizedDescription }
    }

    func deleteTimecard(_ entry:TimeEntryRecord) async {
        do { try await cloud.deleteAdminTimeEntry(id: entry.id); await load() }
        catch { errorMessage = error.localizedDescription }
    }

    func decideEditRequest(_ request: AdminTimeEditRequest, approve: Bool) async {
        do {
            try await cloud.decideTimeEditRequest(id: request.id, approve: approve)
            await load()
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct AdminDashboardView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = WorkspaceService.shared
    @Binding var selectedTab: AdminTab

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("ADMIN WORKSPACE").font(.caption2.bold()).foregroundStyle(.secondary).tracking(1.2)
                    Text(cloud.membership?.organization?.name ?? "Organization").font(.title.bold())
                    Text("People, time approvals and organization access are isolated from the employee workspace.").foregroundStyle(.secondary)
                }.padding(.vertical, 8)
            }
            Section("Needs attention") {
                AdminCountRow(title: "Estimates awaiting approval", value: store.pendingEstimateCount, icon: "doc.text.magnifyingglass") { selectedTab = .estimates }
                AdminCountRow(title: "Submitted timecards", value: store.submittedTimecards.count, icon: "clock.badge.exclamationmark") { selectedTab = .timecards }
                AdminCountRow(title: "Employee edit requests", value: store.editRequests.count, icon: "pencil.and.list.clipboard") { selectedTab = .timecards }
                AdminCountRow(title: "Open employee invites", value: store.openInviteCount, icon: "person.badge.plus") { selectedTab = .invites }
            }
            Section("Organization") {
                AdminCountRow(title: "Active employees", value: store.activeMemberCount, icon: "person.3") { selectedTab = .employees }
            }
        }
        .navigationTitle("Admin")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
    }
}


private struct AdminEstimatesView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store

    private var pending: [AdminEstimatePacket] { store.estimatePackets.filter { ["submitted", "in_review"].contains($0.status) } }
    private var approved: [AdminEstimatePacket] { store.estimatePackets.filter { $0.status == "approved" } }
    private var history: [AdminEstimatePacket] { store.estimatePackets.filter { ["finalized", "sent", "rejected"].contains($0.status) } }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 7) {
                    Text("ESTIMATE APPROVAL").font(.caption2.bold()).tracking(1.1).foregroundStyle(.secondary)
                    Text("Walkthroughs become proposals here").font(.title2.bold())
                    Text("Completed walkthrough sets remain permanently reviewable. Verify scope, approve the estimate, then finalize the customer-facing proposal.").font(.subheadline).foregroundStyle(.secondary)
                }.padding(.vertical, 6)
            }
            Section("Needs review") {
                if pending.isEmpty { ContentUnavailableView("No estimates waiting", systemImage: "checkmark.seal", description: Text("Completed walkthrough sets will appear here automatically.")) }
                ForEach(pending) { packet in packetRow(packet) }
            }
            if !approved.isEmpty {
                Section("Approved · Ready to finalize") { ForEach(approved) { packet in packetRow(packet) } }
            }
            if !history.isEmpty {
                Section("History") { ForEach(history.prefix(40)) { packet in packetRow(packet) } }
            }
        }
        .navigationTitle("Estimates")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
    }

    @ViewBuilder private func packetRow(_ packet: AdminEstimatePacket) -> some View {
        NavigationLink { AdminEstimateDetailView(packetID: packet.id) } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(packet.title).font(.headline)
                        Text(projectName(packet.projectID)).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    EstimateStatusBadge(status: packet.status)
                }
                HStack(spacing: 14) {
                    Label("\(packet.walkthroughCount) walkthroughs", systemImage: "viewfinder")
                    Label(String(format: "%.1f hr", packet.totalLaborHours), systemImage: "clock")
                    Text("Rev \(packet.revision)")
                }.font(.caption2).foregroundStyle(.secondary)
                Text(packet.submittedAt.formatted(date: .abbreviated, time: .shortened)).font(.caption2).foregroundStyle(.tertiary)
            }.padding(.vertical, 5)
        }
    }

    private func projectName(_ id: UUID) -> String { model.projects.first(where: { $0.id == id })?.name ?? "Project" }
}

private struct EstimateStatusBadge: View {
    let status: String
    var body: some View {
        Text(status.replacingOccurrences(of: "_", with: " ").uppercased())
            .font(.caption2.bold()).tracking(0.4)
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(.primary.opacity(0.08), in: Capsule())
    }
}

private struct AdminEstimateDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var title = ""
    @State private var customerName = ""
    @State private var customerEmail = ""
    @State private var scopeSummary = ""
    @State private var customerNotes = ""
    @State private var internalNotes = ""
    @State private var terms = ""
    @State private var subtotal = "0.00"
    @State private var tax = "0.00"
    @State private var rejectionReason = ""
    @State private var showReject = false
    @State private var busy = false
    @State private var shareURL: URL?
    let packetID: UUID

    private var packet: AdminEstimatePacket? { store.estimatePackets.first(where: { $0.id == packetID }) }

    var body: some View {
        Group {
            if let packet {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { EstimateStatusBadge(status: packet.status); Spacer(); Text("REVISION \(packet.revision)").font(.caption2.bold()).foregroundStyle(.secondary) }
                            Text(projectName(packet.projectID)).font(.title.bold())
                            Text("Submitted \(packet.submittedAt.formatted(date: .abbreviated, time: .shortened)) · \(packet.walkthroughCount) walkthroughs · \(String(format: "%.1f", packet.totalLaborHours)) labor hr").font(.caption).foregroundStyle(.secondary)
                        }.padding(.vertical, 5)
                    }

                    Section("Proposal") {
                        TextField("Proposal title", text: $title)
                        TextField("Customer name", text: $customerName)
                        TextField("Customer email", text: $customerEmail).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                        VStack(alignment: .leading) { Text("Scope summary").font(.caption).foregroundStyle(.secondary); TextEditor(text: $scopeSummary).frame(minHeight: 90) }
                        VStack(alignment: .leading) { Text("Customer notes").font(.caption).foregroundStyle(.secondary); TextEditor(text: $customerNotes).frame(minHeight: 70) }
                        VStack(alignment: .leading) { Text("Terms / exclusions").font(.caption).foregroundStyle(.secondary); TextEditor(text: $terms).frame(minHeight: 70) }
                        HStack { TextField("Subtotal", text: $subtotal).keyboardType(.decimalPad); TextField("Tax", text: $tax).keyboardType(.decimalPad) }
                        LabeledContent("Proposal total", value: money(totalCents))
                    }

                    Section("Walkthrough review") {
                        ForEach(packet.walkthroughSnapshot) { walk in
                            DisclosureGroup {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack { metric("Walls", walk.wallCount); metric("Doors", walk.doorCount); metric("Windows", walk.windowCount) }
                                    if let sqft = walk.paintableWallSqft { LabeledContent("Paintable wall", value: String(format: "%.0f sq ft", sqft)) }
                                    if let height = walk.averageWallHeightFt { LabeledContent("Avg wall height", value: String(format: "%.1f ft", height)) }
                                    LabeledContent("Measurements", value: walk.measurementsConfirmed == true ? "Confirmed" : "Needs verification")
                                    if let lines = walk.scopeLines {
                                        ForEach(lines.filter(\.enabled)) { line in
                                            HStack { Text(line.kind.rawValue); Spacer(); Text(String(format: "%.1f %@ · %.2f hr", line.quantity, line.unit, line.laborHours)).foregroundStyle(.secondary) }
                                        }
                                    }
                                    if let note = walk.estimateNotes ?? walk.transcript, !note.isEmpty { Text(note).font(.caption).foregroundStyle(.secondary) }
                                }.font(.subheadline).padding(.vertical, 4)
                            } label: {
                                HStack { VStack(alignment: .leading) { Text(walk.roomName ?? "Room").font(.headline); if let d=walk.capturedAt { Text(d.formatted(date:.abbreviated,time:.shortened)).font(.caption).foregroundStyle(.secondary) } }; Spacer(); if walk.measurementsConfirmed == true { Image(systemName:"checkmark.seal.fill").foregroundStyle(.green) } }
                            }
                        }
                    }

                    if !packet.evidenceSnapshot.isEmpty {
                        Section("Walkthrough evidence") {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(packet.evidenceSnapshot) { evidence in
                                        AdminEvidenceThumbnail(evidence: evidence)
                                    }
                                }.padding(.vertical, 4)
                            }
                            Text("\(packet.evidenceSnapshot.count) tagged evidence captures are preserved with this submitted revision.").font(.caption).foregroundStyle(.secondary)
                        }
                    }

                    if !packet.lineItemSnapshot.isEmpty {
                        Section("Compiled estimate") {
                            ForEach(packet.lineItemSnapshot) { line in
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack { Text(line.name).font(.headline); Spacer(); Text(String(format: "%.2f hr", line.laborHours ?? 0)).font(.caption.monospacedDigit()) }
                                    Text(String(format: "%.1f %@", line.quantity, line.unit)).font(.caption).foregroundStyle(.secondary)
                                    if let desc=line.description { Text(desc).font(.caption2).foregroundStyle(.tertiary) }
                                }.padding(.vertical, 3)
                            }
                        }
                    }

                    Section("Internal review") {
                        TextEditor(text: $internalNotes).frame(minHeight: 80)
                        if let reason=packet.rejectionReason, !reason.isEmpty { LabeledContent("Previous rejection", value: reason) }
                    }

                    Section {
                        if ["submitted","in_review"].contains(packet.status) {
                            Button { Task { await setReview("in_review") } } label: { Label("Mark In Review", systemImage: "eye") }
                            Button { Task { await setReview("approved") } } label: { Label("Approve Estimate", systemImage: "checkmark.seal.fill") }.buttonStyle(.borderedProminent).tint(.accentColor)
                            Button(role: .destructive) { showReject = true } label: { Label("Reject for Revision", systemImage: "arrow.uturn.backward.circle") }
                        }
                        if packet.status == "approved" || packet.status == "finalized" {
                            Button { Task { await finalize() } } label: { Label(packet.status == "finalized" ? "Update Final Proposal" : "Finalize Customer Proposal", systemImage: "doc.badge.gearshape") }.buttonStyle(.borderedProminent).tint(.accentColor)
                        }
                        if packet.status == "finalized" {
                            Button { shareURL = ProposalPDFBuilder.make(packet: packet, projectName: projectName(packet.projectID)) } label: { Label("Prepare Customer PDF", systemImage: "square.and.arrow.up") }
                            if let shareURL { ShareLink(item: shareURL) { Label("Share Final Proposal PDF", systemImage: "paperplane.fill") } }
                        }
                    }
                }
                .navigationTitle("Estimate Review")
                .navigationBarTitleDisplayMode(.inline)
                .onAppear { hydrate(packet) }
                .onChange(of: packet.id) { _, _ in hydrate(packet) }
            } else { ContentUnavailableView("Estimate unavailable", systemImage: "doc.questionmark") }
        }
        .alert("Reject estimate", isPresented: $showReject) {
            TextField("Reason / requested changes", text: $rejectionReason)
            Button("Cancel", role: .cancel) {}
            Button("Reject", role: .destructive) { Task { await setReview("rejected", note: rejectionReason) } }
        } message: { Text("The submitted packet remains in history and can be revised in a new walkthrough/estimate revision.") }
        .disabled(busy)
    }

    private var totalCents: Int { cents(subtotal) + cents(tax) }
    private func money(_ cents: Int) -> String { (Double(cents)/100).formatted(.currency(code:"USD")) }
    private func cents(_ value: String) -> Int { Int(((Double(value) ?? 0) * 100).rounded()) }
    private func projectName(_ id: UUID) -> String { model.projects.first(where: { $0.id == id })?.name ?? "Project" }
    @ViewBuilder private func metric(_ title:String,_ value:Int?) -> some View { VStack(alignment:.leading){Text(title).font(.caption2).foregroundStyle(.secondary);Text("\(value ?? 0)").font(.headline.monospacedDigit())}.frame(maxWidth:.infinity,alignment:.leading) }

    private func hydrate(_ p: AdminEstimatePacket) {
        title=p.title; customerName=p.customerName ?? ""; customerEmail=p.customerEmail ?? ""; scopeSummary=p.scopeSummary ?? defaultScope(p); customerNotes=p.customerNotes ?? ""; internalNotes=p.internalNotes ?? ""; terms=p.terms ?? ""; subtotal=String(format:"%.2f",Double(p.subtotalCents)/100); tax=String(format:"%.2f",Double(p.taxCents)/100)
    }
    private func defaultScope(_ p: AdminEstimatePacket) -> String { p.walkthroughSnapshot.map { $0.roomName ?? "Room" }.joined(separator: ", ") }
    private func setReview(_ status:String,note:String?=nil) async { busy=true; defer{busy=false}; do { try await EstimateAdminService.shared.setReviewState(id:packetID,status:status,note:note ?? internalNotes); await store.load() } catch { store.errorMessage="Estimate review could not be updated. Reference: AF-EST-201" } }
    private func finalize() async { busy=true; defer{busy=false}; do { try await EstimateAdminService.shared.finalize(id:packetID,title:title.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty ? "Proposal" : title,customerName:customerName,customerEmail:customerEmail.isEmpty ? nil : customerEmail,scopeSummary:scopeSummary.isEmpty ? nil : scopeSummary,customerNotes:customerNotes.isEmpty ? nil : customerNotes,terms:terms.isEmpty ? nil : terms,subtotalCents:cents(subtotal),taxCents:cents(tax)); await store.load() } catch { store.errorMessage="Proposal could not be finalized. Reference: AF-EST-202" } }
}

private struct AdminEvidenceThumbnail: View {
    let evidence: AdminEstimateEvidence
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            RoundedRectangle(cornerRadius: 12)
                .fill(.primary.opacity(0.06))
                .overlay { Image(systemName: "photo.on.rectangle.angled").font(.title2).foregroundStyle(.secondary) }
                .frame(width: 150, height: 100)
            Text(evidence.evidenceTag ?? "Evidence").font(.caption.bold())
            Text(evidence.capturedAt.formatted(date: .abbreviated, time: .shortened)).font(.caption2).foregroundStyle(.secondary)
            Text("Preserved in walkthrough storage").font(.caption2).foregroundStyle(.tertiary)
        }.frame(width: 150, alignment: .leading)
    }
}

private enum ProposalPDFBuilder {
    static func make(packet: AdminEstimatePacket, projectName: String) -> URL? {
        let url=FileManager.default.temporaryDirectory.appendingPathComponent("Aurelium-Proposal-\(packet.id.uuidString.prefix(8)).pdf")
        let renderer=UIGraphicsPDFRenderer(bounds:CGRect(x:0,y:0,width:612,height:792))
        do {
            try renderer.writePDF(to:url) { context in
                context.beginPage()
                var y:CGFloat=48
                func draw(_ text:String,size:CGFloat=12,bold:Bool=false,space:CGFloat=22){
                    let font=bold ? UIFont.boldSystemFont(ofSize:size) : UIFont.systemFont(ofSize:size)
                    let attrs:[NSAttributedString.Key:Any]=[.font:font,.foregroundColor:UIColor.label]
                    let rect=CGRect(x:48,y:y,width:516,height:space*3)
                    let h=(text as NSString).boundingRect(with:rect.size,options:[.usesLineFragmentOrigin,.usesFontLeading],attributes:attrs,context:nil).height
                    (text as NSString).draw(in:CGRect(x:48,y:y,width:516,height:max(h,space)),withAttributes:attrs)
                    y += max(h,space)+6
                }
                draw("AURELIUM FIELD",size:11,bold:true)
                draw(packet.title,size:24,bold:true,space:32)
                draw(projectName,size:15,bold:true)
                if let customer=packet.customerName,!customer.isEmpty { draw("Prepared for \(customer)") }
                draw("Revision \(packet.revision) · \(packet.walkthroughCount) verified walkthroughs · \(String(format:"%.1f",packet.totalLaborHours)) estimated labor hours")
                if let scope=packet.scopeSummary,!scope.isEmpty { draw("Scope",size:15,bold:true); draw(scope) }
                draw("Walkthrough takeoff",size:15,bold:true)
                for walk in packet.walkthroughSnapshot.prefix(16) { draw("• \(walk.roomName ?? "Room"): \(String(format:"%.0f",walk.paintableWallSqft ?? 0)) sq ft walls · \(walk.doorCount ?? 0) doors · \(walk.windowCount ?? 0) windows",size:10,space:16) }
                if let notes=packet.customerNotes,!notes.isEmpty { draw("Notes",size:15,bold:true); draw(notes) }
                if let terms=packet.terms,!terms.isEmpty { draw("Terms & exclusions",size:15,bold:true); draw(terms,size:10) }
                y=max(y,650); draw("Subtotal: \((Double(packet.subtotalCents)/100).formatted(.currency(code:"USD")))",size:13,bold:true); draw("Tax: \((Double(packet.taxCents)/100).formatted(.currency(code:"USD")))",size:12); draw("Total: \((Double(packet.totalCents)/100).formatted(.currency(code:"USD")))",size:18,bold:true)
            }
            return url
        } catch { return nil }
    }
}

private struct AdminCountRow: View {
    let title: String
    let value: Int
    let icon: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).frame(width: 26).foregroundStyle(.secondary)
                Text(title).foregroundStyle(.primary)
                Spacer()
                Text("\(value)").font(.headline.monospacedDigit())
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }.contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}

private struct AdminTimecardsView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var editing: TimeEntryRecord?
    @State private var rejectTarget: TimeEntryRecord?
    @State private var rejectionReason = ""
    @State private var deleteTarget: TimeEntryRecord?

    var body: some View {
        List {
            if !store.editRequests.isEmpty {
                Section("Employee edit requests") {
                    ForEach(store.editRequests) { request in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(store.name(for: request.requestedBy)).font(.headline)
                            Text(request.reason).foregroundStyle(.secondary)
                            Text(formatRange(request.proposedClockIn, request.proposedClockOut)).font(.caption).foregroundStyle(.secondary)
                            HStack {
                                Button("Reject", role: .destructive) { Task { await store.decideEditRequest(request, approve: false) } }
                                Spacer()
                                Button("Approve Changes") { Task { await store.decideEditRequest(request, approve: true) } }.buttonStyle(.borderedProminent).tint(.primary)
                            }
                        }.padding(.vertical, 6)
                    }
                }
            }
            Section("Submitted") {
                if store.submittedTimecards.isEmpty {
                    ContentUnavailableView("No timecards waiting", systemImage: "checkmark.circle", description: Text("Submitted employee timecards will appear here."))
                }
                ForEach(store.submittedTimecards) { entry in
                    AdminTimecardRow(entry: entry, employee: store.name(for: entry.userID), project: projectName(entry.projectID)) {
                        editing = entry
                    } approve: {
                        Task { await store.approve(entry) }
                    } reject: {
                        rejectionReason = ""
                        rejectTarget = entry
                    } delete: { deleteTarget = entry }
                }
            }
            if !store.reviewedTimecards.isEmpty {
                Section("Reviewed history") {
                    ForEach(store.reviewedTimecards.prefix(30)) { entry in
                        AdminTimecardRow(entry: entry, employee: store.name(for: entry.userID), project: projectName(entry.projectID)) { editing = entry } delete: { deleteTarget = entry }
                    }
                }
            }
            if !store.otherTimecards.isEmpty {
                Section("Draft / open timecards") {
                    ForEach(store.otherTimecards.prefix(30)) { entry in
                        AdminTimecardRow(entry:entry,employee:store.name(for:entry.userID),project:projectName(entry.projectID)){editing=entry} delete:{deleteTarget=entry}
                    }
                }
            }
        }
        .navigationTitle("Timecards")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
        .sheet(item: $editing) { AdminTimeEntryEditor(entry: $0) { await store.load() } }
        .alert("Reject timecard", isPresented: Binding(get: { rejectTarget != nil }, set: { if !$0 { rejectTarget = nil } })) {
            TextField("Reason", text: $rejectionReason)
            Button("Cancel", role: .cancel) { rejectTarget = nil }
            Button("Reject", role: .destructive) {
                if let entry = rejectTarget { Task { await store.reject(entry, note: rejectionReason) } }
                rejectTarget = nil
            }
        } message: { Text("The employee will see this timecard as rejected and may correct and resubmit it.") }
        .confirmationDialog("Delete timecard?", isPresented:Binding(get:{deleteTarget != nil},set:{if !$0{deleteTarget=nil}}),titleVisibility:.visible){
            Button("DELETE",role:.destructive){if let entry=deleteTarget{Task{await store.deleteTimecard(entry)}};deleteTarget=nil}
            Button("Cancel",role:.cancel){deleteTarget=nil}
        } message:{Text("This permanently deletes the timecard and its GPS/edit-request history. This cannot be undone.")}
    }

    private func projectName(_ id: UUID) -> String { model.projects.first(where: { $0.id == id })?.name ?? "Project" }
}

private struct AdminTimecardRow: View {
    let entry: TimeEntryRecord
    let employee: String
    let project: String
    let edit: () -> Void
    var approve: (() -> Void)? = nil
    var reject: (() -> Void)? = nil
    var delete: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack { Text(employee).font(.headline); Spacer(); Text(entry.status.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary) }
            Text(project).font(.subheadline).foregroundStyle(.secondary)
            Text(formatRange(entry.clockIn, entry.clockOut)).font(.caption).foregroundStyle(.secondary)
            HStack {
                Button("Edit", action: edit).buttonStyle(.bordered)
                if let delete { Button(role:.destructive,action:delete){Label("Delete",systemImage:"trash")} }
                Spacer()
                if let reject { Button("Reject", role: .destructive, action: reject) }
                if let approve { Button("Approve", action: approve).buttonStyle(.borderedProminent).tint(.primary) }
            }
        }.padding(.vertical, 5)
    }
}

private struct AdminTimeEntryEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = WorkspaceService.shared
    @State var entry: TimeEntryRecord
    @State private var adjustmentReason = ""
    let onSaved: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Picker("Project", selection: $entry.projectID) { ForEach(model.projects) { Text($0.name).tag($0.id) } }
                DatePicker("Clock in", selection: $entry.clockIn)
                DatePicker("Clock out", selection: Binding(get: { entry.clockOut ?? entry.clockIn }, set: { entry.clockOut = $0 }))
                TextField("Cost code", text: optionalText($entry.costCode))
                TextField("Notes", text: optionalText($entry.notes), axis: .vertical)
                Section("Audit note") {
                    TextField("Reason for admin adjustment", text: $adjustmentReason, axis: .vertical)
                    Text("Admin edits are recorded with the administrator and timestamp.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Edit Timecard")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }.disabled(adjustmentReason.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                }
            }
        }
    }

    private func save() async {
        do {
            try await cloud.updateAdminTimeEntry(entry, reason: adjustmentReason)
            await onSaved()
            dismiss()
        } catch { store.errorMessage = error.localizedDescription }
    }
}

private struct AdminEmployeesView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = WorkspaceService.shared
    @State private var editing: AdminOrganizationMember?
    @State private var removeTarget: AdminOrganizationMember?

    var body: some View {
        List {
            ForEach(store.members) { member in
                HStack(spacing: 12) {
                    Circle().fill(.quaternary).frame(width: 42, height: 42).overlay(Text(initial(member)).font(.headline))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(member.displayName ?? member.email ?? "Unnamed employee").font(.headline)
                        Text("\(member.email ?? "No email") · \(member.role.capitalized)").font(.caption).foregroundStyle(.secondary)
                        if member.active { Text("Active").font(.caption2.bold()).foregroundStyle(.green) }
                        else { Text("Inactive").font(.caption2.bold()).foregroundStyle(.secondary) }
                    }
                    Spacer()
                    Menu {
                        Button("Edit Employee", systemImage: "pencil") { editing = member }
                        if member.active && member.role != "owner" { Button("Remove from Organization", systemImage: "person.fill.xmark", role: .destructive) { removeTarget = member } }
                    } label: { Image(systemName: "ellipsis.circle").font(.title3) }
                }.padding(.vertical, 4)
            }
        }
        .navigationTitle("Employees")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
        .sheet(item: $editing) { AdminEmployeeEditor(member: $0) { await store.load() } }
        .confirmationDialog("Remove employee?", isPresented: Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } }), titleVisibility: .visible) {
            Button("Remove from Organization", role: .destructive) {
                if let member = removeTarget { Task { await remove(member) } }
                removeTarget = nil
            }
            Button("Cancel", role: .cancel) { removeTarget = nil }
        } message: { Text("Access is deactivated, but historical timecards and audit records are preserved.") }
    }

    private func initial(_ member: AdminOrganizationMember) -> String { String((member.displayName ?? member.email ?? "?").prefix(1)).uppercased() }
    private func remove(_ member: AdminOrganizationMember) async {
        do { try await cloud.removeAdminMember(userID: member.userID); await store.load() }
        catch { store.errorMessage = error.localizedDescription }
    }
}

private struct AdminEmployeeEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = WorkspaceService.shared
    @State var member: AdminOrganizationMember
    let onSaved: () async -> Void
    private let roles = ["crew", "foreman", "estimator", "pm", "office", "admin", "owner"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Display name", text: optionalText($member.displayName))
                LabeledContent("Email", value: member.email ?? "Unavailable")
                TextField("Phone", text: optionalText($member.phone)).keyboardType(.phonePad)
                Picker("Role", selection: $member.role) { ForEach(roles, id: \.self) { Text($0.capitalized).tag($0) } }
                Toggle("Active organization access", isOn: $member.active)
            }
            .navigationTitle("Edit Employee")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } } }
            }
        }
    }

    private func save() async {
        do { try await cloud.updateAdminMember(member); await onSaved(); dismiss() }
        catch { store.errorMessage = error.localizedDescription }
    }
}

private struct AdminInvitesView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = WorkspaceService.shared
    @State private var email = ""
    @State private var role = "crew"
    @State private var generatedURL: URL?
    private let roles = ["crew", "foreman", "estimator", "pm", "office", "admin"]

    var body: some View {
        List {
            Section("New employee invite") {
                TextField("Employee email (recommended)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                Picker("Role", selection: $role) { ForEach(roles, id: \.self) { Text($0.capitalized).tag($0) } }
                Button("Generate Join Link", systemImage: "person.badge.plus") { Task { await generate() } }
                if let generatedURL {
                    Text(generatedURL.absoluteString).font(.caption).textSelection(.enabled)
                    ShareLink(item: generatedURL) { Label("Email or Share Invite", systemImage: "square.and.arrow.up") }
                }
            }
            Section("Invite history") {
                ForEach(store.invites) { invite in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text(invite.email ?? "Open email invite").font(.headline); Spacer(); Text(invite.role.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary) }
                        Text(inviteStatus(invite)).font(.caption).foregroundStyle(.secondary)
                        if invite.acceptedAt == nil && invite.revokedAt == nil && invite.expiresAt > .now {
                            Button("Revoke Invite", role: .destructive) { Task { await revoke(invite) } }.font(.caption.bold())
                        }
                    }.padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Invites")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
    }

    private func generate() async {
        do {
            let token = try await cloud.createOrganizationInvite(email: email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : email.trimmingCharacters(in: .whitespacesAndNewlines), role: role)
            generatedURL = URL(string: "https://whatmod.com/app/#/join?invite=\(token.uuidString)")
            await store.load()
        } catch { store.errorMessage = error.localizedDescription }
    }

    private func revoke(_ invite: OrganizationInviteRecord) async {
        do { try await cloud.revokeOrganizationInvite(id: invite.id); await store.load() }
        catch { store.errorMessage = error.localizedDescription }
    }

    private func inviteStatus(_ invite: OrganizationInviteRecord) -> String {
        if invite.acceptedAt != nil { return "Accepted" }
        if invite.revokedAt != nil { return "Revoked" }
        if invite.expiresAt <= .now { return "Expired" }
        return "Active · expires \(invite.expiresAt.formatted(date: .abbreviated, time: .omitted))"
    }
}

@ToolbarContentBuilder
private func adminEmployeeToolbar(model: AppModel) -> some ToolbarContent {
    ToolbarItem(placement: .topBarTrailing) {
        Menu {
            Button {
                model.workspaceMode = .employee
            } label: {
                Label("Employee View", systemImage: "person.crop.circle")
            }
            Button(role: .destructive) {
                model.workspaceMode = .employee
                Task { await WorkspaceService.shared.signOut() }
            } label: {
                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } label: {
            Label("Account", systemImage: "person.crop.circle.badge.gearshape")
        }
    }
}

private func optionalText(_ binding: Binding<String?>) -> Binding<String> {
    Binding<String>(get: { binding.wrappedValue ?? "" }, set: { binding.wrappedValue = $0.isEmpty ? nil : $0 })
}

private func formatRange(_ start: Date, _ end: Date?) -> String {
    let startText = start.formatted(date: .abbreviated, time: .shortened)
    guard let end else { return "\(startText) – open" }
    return "\(startText) – \(end.formatted(date: .omitted, time: .shortened))"
}

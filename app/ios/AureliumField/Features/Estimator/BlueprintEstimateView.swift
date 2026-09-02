import Foundation
import SwiftUI
import UniformTypeIdentifiers

enum BlueprintReviewSection: String, CaseIterable, Identifiable {
    case overview = "Overview"
    case takeoff = "Takeoff"
    case sheets = "Sheets"
    case issues = "Issues"
    var id: String { rawValue }
}

struct BlueprintEstimateView: View {
    let project: ProjectSummary
    @Environment(AppModel.self) private var model
    @State private var importing = false
    @State private var analyzing = false
    @State private var draft: BlueprintEstimateDraft?
    @State private var errorMessage: String?
    @State private var section: BlueprintReviewSection = .overview
    @State private var editingQuantity: BlueprintQuantity?
    @State private var showingAssumptions = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                hero
                importButton

                if analyzing {
                    HStack(spacing: 12) {
                        ProgressView()
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Deconstructing plan set…").font(.headline)
                            Text("Reading sheets, finish schedules, scales, dimensions and paint scope.").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(16)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                if let current = draft {
                    reviewNavigation
                    switch section {
                    case .overview: overview(current)
                    case .takeoff: takeoff(current)
                    case .sheets: sheets(current)
                    case .issues: issues(current)
                    }
                }
            }
            .padding()
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .image], allowsMultipleSelection: false) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            Task { await analyze(url) }
        }
        .sheet(item: $editingQuantity) { quantity in
            BlueprintQuantityEditor(quantity: quantity) { updated in
                updateQuantity(updated)
            }
        }
        .sheet(isPresented: $showingAssumptions) {
            if let current = draft {
                BlueprintAssumptionsEditor(value: current.assumptions ?? BlueprintAssumptions()) { value in
                    var next = current
                    next.assumptions = value
                    draft = recalculate(next)
                    saveDraft()
                }
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("PLAN INTELLIGENCE", systemImage: "sparkles.rectangle.stack.fill")
                .font(.caption2.bold())
                .tracking(1.2)
                .foregroundStyle(.secondary)
            Text("Blueprint Estimate").font(.largeTitle.bold())
            Text("Turn plans and finish schedules into an auditable painting takeoff. Aurelium shows what it found, how it calculated it, and exactly what still needs verification before proposal generation.")
                .foregroundStyle(.secondary)
        }
    }

    private var importButton: some View {
        Button { importing = true } label: {
            Label(draft == nil ? "Import Plan Set" : "Analyze Another Plan Set", systemImage: "doc.badge.plus")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
    }

    private var reviewNavigation: some View {
        Picker("Review", selection: $section) {
            ForEach(BlueprintReviewSection.allCases) { item in Text(item.rawValue).tag(item) }
        }
        .pickerStyle(.segmented)
    }

    private func overview(_ d: BlueprintEstimateDraft) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            readinessCard(d)
            assumptionsCard(d)
            scopeSummary(d)
            proposalCard(d)
        }
    }

    private func readinessCard(_ d: BlueprintEstimateDraft) -> some View {
        let blocking = unresolvedBlocking(d)
        let warnings = unresolvedWarnings(d)
        let verified = d.pages.flatMap(\.quantities).filter { !$0.needsVerification }.count
        let total = max(1, d.pages.flatMap(\.quantities).count)
        let confidence = Int((Double(verified) / Double(total)) * 100)
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(d.fileName).font(.headline)
                    Text("\(d.pages.count) sheets · imported \(d.importedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Label(d.proposalReady ? "Ready" : "Review", systemImage: d.proposalReady ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(d.proposalReady ? .green : .orange)
            }
            ProgressView(value: Double(confidence), total: 100)
            HStack(spacing: 8) {
                metric("Paintable", String(format: "%.0f sf", d.totalPaintableSquareFeet))
                metric("Labor", String(format: "%.1f hr", d.totalLaborHours))
                metric("Verified", "\(confidence)%")
            }
            HStack(spacing: 16) {
                Label("\(blocking) blocking", systemImage: "octagon.fill").foregroundStyle(blocking == 0 ? Color.secondary : Color.red)
                Label("\(warnings) warnings", systemImage: "exclamationmark.triangle.fill").foregroundStyle(warnings == 0 ? Color.secondary : Color.orange)
            }
            .font(.caption.bold())
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20))
    }

    private func assumptionsCard(_ d: BlueprintEstimateDraft) -> some View {
        let a = d.assumptions ?? BlueprintAssumptions()
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Estimating assumptions").font(.headline)
                    Text("Applied consistently across this takeoff").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Edit") { showingAssumptions = true }
            }
            HStack(spacing: 8) {
                assumptionChip("\(a.coats) coats")
                assumptionChip(String(format: "%.0f%% waste", a.wastePercent))
                assumptionChip(a.wallHeightFeet.map { String(format: "%.1f ft fallback", $0) } ?? "Plan heights only")
            }
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    private func scopeSummary(_ d: BlueprintEstimateDraft) -> some View {
        let grouped = Dictionary(grouping: d.pages.flatMap(\.quantities), by: \.scope)
        return VStack(alignment: .leading, spacing: 10) {
            HStack { Text("Scope takeoff").font(.title2.bold()); Spacer(); Button("Review") { section = .takeoff } }
            ForEach(EstimateScopeKind.allCases, id: \.self) { scope in
                let rows = grouped[scope] ?? []
                if !rows.isEmpty {
                    HStack {
                        Image(systemName: scopeIcon(scope)).frame(width: 26)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(scope.rawValue).font(.headline)
                            Text("\(rows.count) source item\(rows.count == 1 ? "" : "s")").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(scopeTotal(rows, scope: scope)).font(.headline.monospacedDigit())
                    }
                    .padding(12)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    private func proposalCard(_ d: BlueprintEstimateDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Proposal gate").font(.headline)
            Text(d.proposalReady ? "All blocking gaps are resolved. Generate a proposal draft from the reviewed quantities and assumptions." : "Resolve blocking measurements and verify flagged takeoff lines before Aurelium treats this estimate as proposal-ready.")
                .font(.subheadline).foregroundStyle(.secondary)
            Button {
                var reviewed = d
                reviewed.reviewedAt = .now
                draft = recalculate(reviewed)
                saveDraft()
                if let ready = draft { model.generateProposal(from: ready) }
            } label: {
                Label("Generate Proposal Draft", systemImage: "doc.text.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!d.proposalReady)
        }
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    private func takeoff(_ d: BlueprintEstimateDraft) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text("Paint takeoff").font(.title2.bold())
                    Text("Tap any line to verify or correct the extracted quantity.").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            ForEach(d.pages.flatMap(\.quantities)) { q in
                Button { editingQuantity = q } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: q.needsVerification ? "questionmark.circle.fill" : "checkmark.circle.fill")
                            .foregroundStyle(q.needsVerification ? .orange : .green)
                            .font(.title3)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(q.scope.rawValue).font(.headline)
                            Text("Sheet \(q.pageNumber) · \(q.sourceLabel)").font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            Text(q.evidence).font(.caption2).foregroundStyle(.tertiary).lineLimit(2)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(String(format: "%.1f %@", q.quantity, q.unit)).font(.headline.monospacedDigit())
                            Text("\(Int(q.confidence * 100))% confidence").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    .padding(14)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func sheets(_ d: BlueprintEstimateDraft) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sheet deconstruction").font(.title2.bold())
            ForEach(d.pages) { p in
                DisclosureGroup("Sheet \(p.pageNumber) · \(p.title)") {
                    VStack(alignment: .leading, spacing: 9) {
                        if let scale = p.drawingScale { Label("Scale: \(scale)", systemImage: "ruler") }
                        if !p.roomNames.isEmpty { detailBlock("Spaces", p.roomNames.prefix(12).joined(separator: ", ")) }
                        if !p.finishCodes.isEmpty { detailBlock("Finish codes", p.finishCodes.joined(separator: ", ")) }
                        LabeledContent("Takeoff lines", value: "\(p.quantities.count)")
                        LabeledContent("Issues", value: "\(p.issues.filter { !$0.resolved }.count)")
                    }
                    .padding(.top, 8)
                }
                .padding(14)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    private func issues(_ d: BlueprintEstimateDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Missing / uncertain information").font(.title2.bold())
            if d.issues.isEmpty {
                Label("No plan issues detected", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
            } else {
                ForEach(d.issues) { issue in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: issue.resolved ? "checkmark.circle.fill" : (issue.severity == .blocking ? "exclamationmark.octagon.fill" : "exclamationmark.triangle.fill"))
                            .foregroundStyle(issue.resolved ? .green : (issue.severity == .blocking ? .red : .orange))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Sheet \(issue.pageNumber) · \(issue.severity.rawValue.capitalized)").font(.caption.bold())
                            Text(issue.message).font(.subheadline)
                        }
                        Spacer()
                        Button(issue.resolved ? "Reopen" : "Resolve") { toggleIssue(issue.id) }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                    }
                    .padding(12)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    private func analyze(_ url: URL) async {
        analyzing = true
        errorMessage = nil
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            var value = try await BlueprintAnalysisService.shared.analyze(url: url, projectID: project.id)
            value.assumptions = BlueprintAssumptions()
            draft = recalculate(value)
            saveDraft()
        } catch {
            errorMessage = "Blueprint analysis could not finish. Reference: AF-BP-103"
        }
        analyzing = false
    }

    private func updateQuantity(_ updated: BlueprintQuantity) {
        guard var next = draft else { return }
        for pageIndex in next.pages.indices {
            if let index = next.pages[pageIndex].quantities.firstIndex(where: { $0.id == updated.id }) {
                next.pages[pageIndex].quantities[index] = updated
            }
        }
        draft = recalculate(next)
        saveDraft()
    }

    private func toggleIssue(_ id: UUID) {
        guard var next = draft else { return }
        if let index = next.issues.firstIndex(where: { $0.id == id }) { next.issues[index].resolved.toggle() }
        for pageIndex in next.pages.indices {
            if let index = next.pages[pageIndex].issues.firstIndex(where: { $0.id == id }) {
                next.pages[pageIndex].issues[index].resolved.toggle()
            }
        }
        draft = recalculate(next)
        saveDraft()
    }

    private func recalculate(_ input: BlueprintEstimateDraft) -> BlueprintEstimateDraft {
        var next = input
        let a = next.assumptions ?? BlueprintAssumptions()

        if let fallbackHeight = a.wallHeightFeet, fallbackHeight > 0 {
            for pageIndex in next.pages.indices {
                let geometries = next.pages[pageIndex].roomGeometries ?? []
                if !geometries.isEmpty {
                    next.pages[pageIndex].quantities.removeAll { $0.scope == .walls && $0.sourceLabel.hasPrefix("Fallback height ·") }
                    for room in geometries {
                        let grossWalls = 2 * (room.lengthFeet + room.widthFeet) * fallbackHeight
                        next.pages[pageIndex].quantities.append(BlueprintQuantity(pageNumber: next.pages[pageIndex].pageNumber, sourceLabel: "Fallback height · \(room.label)", scope: .walls, quantity: grossWalls, unit: "sq ft", confidence: 0.92, evidence: "Verified room dimensions × estimator fallback wall height \(String(format: "%.1f", fallbackHeight)) ft; openings still require verification", needsVerification: true))
                    }
                }
                for issueIndex in next.pages[pageIndex].issues.indices where next.pages[pageIndex].issues[issueIndex].message.contains("no reliable wall/ceiling height") {
                    next.pages[pageIndex].issues[issueIndex].resolved = true
                }
            }
            for issueIndex in next.issues.indices where next.issues[issueIndex].message.contains("no reliable wall/ceiling height") {
                next.issues[issueIndex].resolved = true
            }
        }

        let all = next.pages.flatMap(\.quantities)
        let included = all.filter { q in
            switch q.scope {
            case .walls: return a.includeWalls
            case .ceiling: return a.includeCeilings
            case .trim: return a.includeTrim
            case .doors: return a.includeDoors
            case .windows: return a.includeWindows
            }
        }
        let area = included.filter { $0.scope == .walls || $0.scope == .ceiling }.reduce(0) { $0 + $1.quantity }
        next.totalPaintableSquareFeet = area * (1 + max(0, a.wastePercent) / 100)
        let coatFactor = Double(max(1, a.coats))
        next.totalLaborHours = included.reduce(0) { partial, q in
            let rate: Double
            switch q.scope {
            case .walls: rate = a.wallProductionRate
            case .ceiling: rate = a.ceilingProductionRate
            case .trim: rate = a.trimProductionRate
            case .doors: rate = a.doorProductionRate
            case .windows: rate = a.windowProductionRate
            }
            guard rate > 0 else { return partial }
            return partial + ((q.quantity / rate) * coatFactor)
        }
        next.proposalReady = unresolvedBlocking(next) == 0 && !included.contains(where: { $0.needsVerification })
        return next
    }

    private func saveDraft() {
        guard let draft else { return }
        model.saveBlueprintDraft(draft)
    }

    private func unresolvedBlocking(_ d: BlueprintEstimateDraft) -> Int { d.issues.filter { $0.severity == .blocking && !$0.resolved }.count }
    private func unresolvedWarnings(_ d: BlueprintEstimateDraft) -> Int { d.issues.filter { $0.severity == .warning && !$0.resolved }.count }
    private func metric(_ title: String, _ value: String) -> some View { VStack(alignment: .leading) { Text(title).font(.caption).foregroundStyle(.secondary); Text(value).font(.title3.bold()) }.frame(maxWidth: .infinity, alignment: .leading) }
    private func assumptionChip(_ text: String) -> some View { Text(text).font(.caption.bold()).padding(.horizontal, 9).padding(.vertical, 6).background(.quaternary, in: Capsule()) }
    private func detailBlock(_ title: String, _ value: String) -> some View { VStack(alignment: .leading, spacing: 2) { Text(title).font(.caption.bold()); Text(value).font(.caption).foregroundStyle(.secondary) } }
    private func scopeTotal(_ rows: [BlueprintQuantity], scope: EstimateScopeKind) -> String { let total = rows.reduce(0) { $0 + $1.quantity }; return String(format: scope == .doors || scope == .windows ? "%.0f" : "%.0f %@", total, rows.first?.unit ?? "") }
    private func scopeIcon(_ scope: EstimateScopeKind) -> String { switch scope { case .walls: return "square.split.2x1"; case .doors: return "door.left.hand.open"; case .windows: return "rectangle.split.3x1"; case .trim: return "ruler"; case .ceiling: return "rectangle.tophalf.inset.filled" } }
}

private struct BlueprintQuantityEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var quantity: BlueprintQuantity
    let onSave: (BlueprintQuantity) -> Void

    init(quantity: BlueprintQuantity, onSave: @escaping (BlueprintQuantity) -> Void) {
        _quantity = State(initialValue: quantity)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Takeoff line") {
                    LabeledContent("Scope", value: quantity.scope.rawValue)
                    LabeledContent("Sheet", value: "\(quantity.pageNumber)")
                    Text(quantity.sourceLabel).font(.subheadline)
                }
                Section("Verified quantity") {
                    HStack {
                        TextField("Quantity", value: $quantity.quantity, format: .number).keyboardType(.decimalPad)
                        Text(quantity.unit).foregroundStyle(.secondary)
                    }
                    Toggle("I verified this takeoff line", isOn: Binding(get: { !quantity.needsVerification }, set: { quantity.needsVerification = !$0; if $0 { quantity.confidence = max(quantity.confidence, 0.98) } }))
                }
                Section("Source evidence") { Text(quantity.evidence).font(.caption).foregroundStyle(.secondary) }
            }
            .navigationTitle("Review Quantity")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { onSave(quantity); dismiss() }.disabled(quantity.quantity < 0) }
            }
        }
    }
}

private struct BlueprintAssumptionsEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var value: BlueprintAssumptions
    let onSave: (BlueprintAssumptions) -> Void

    init(value: BlueprintAssumptions, onSave: @escaping (BlueprintAssumptions) -> Void) {
        _value = State(initialValue: value)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Application") {
                    Stepper("Coats: \(value.coats)", value: $value.coats, in: 1...5)
                    HStack { Text("Waste"); Spacer(); TextField("5", value: $value.wastePercent, format: .number).keyboardType(.decimalPad).frame(width: 70); Text("%") }
                    HStack { Text("Fallback wall height"); Spacer(); TextField("Optional", value: Binding(get: { value.wallHeightFeet ?? 0 }, set: { value.wallHeightFeet = $0 > 0 ? $0 : nil }), format: .number).keyboardType(.decimalPad).frame(width: 90); Text("ft") }
                }
                Section("Include scope") {
                    Toggle("Paint walls", isOn: $value.includeWalls)
                    Toggle("Paint ceilings", isOn: $value.includeCeilings)
                    Toggle("Paint trim", isOn: $value.includeTrim)
                    Toggle("Paint doors", isOn: $value.includeDoors)
                    Toggle("Paint windows", isOn: $value.includeWindows)
                }
                Section("Production rates") {
                    rateRow("Walls", value: $value.wallProductionRate, unit: "sf/hr")
                    rateRow("Ceilings", value: $value.ceilingProductionRate, unit: "sf/hr")
                    rateRow("Trim", value: $value.trimProductionRate, unit: "lf/hr")
                    rateRow("Doors", value: $value.doorProductionRate, unit: "doors/hr")
                    rateRow("Windows", value: $value.windowProductionRate, unit: "windows/hr")
                }
            }
            .navigationTitle("Takeoff Assumptions")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { onSave(value); dismiss() } }
            }
        }
    }

    private func rateRow(_ title: String, value: Binding<Double>, unit: String) -> some View {
        HStack { Text(title); Spacer(); TextField("0", value: value, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 80); Text(unit).font(.caption).foregroundStyle(.secondary) }
    }
}

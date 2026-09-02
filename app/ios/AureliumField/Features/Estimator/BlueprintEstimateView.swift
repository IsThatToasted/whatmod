import SwiftUI
import UniformTypeIdentifiers

struct BlueprintEstimateView: View {
    let project: ProjectSummary
    @Environment(AppModel.self) private var model
    @State private var importing=false
    @State private var analyzing=false
    @State private var draft:BlueprintEstimateDraft?
    @State private var errorMessage:String?

    var body: some View {
        ScrollView {
            VStack(alignment:.leading,spacing:18) {
                VStack(alignment:.leading,spacing:6){Text("PLAN INTELLIGENCE").font(.caption2.bold()).tracking(1.2).foregroundStyle(.secondary);Text("Blueprint Estimate").font(.largeTitle.bold());Text("Deconstruct plans, finish schedules and explicit dimensions into a verified painting scope before Aurelium builds a proposal.").foregroundStyle(.secondary)}
                Button { importing=true } label:{Label(draft == nil ? "Import Plans / Blueprints":"Analyze Another Plan",systemImage:"doc.badge.plus").frame(maxWidth:.infinity)}.buttonStyle(.borderedProminent).controlSize(.large)
                if analyzing { HStack{ProgressView();Text("Reading sheets, schedules, scales and dimensions…").foregroundStyle(.secondary)}.padding() }
                if let errorMessage { Text(errorMessage).font(.caption).foregroundStyle(.red) }
                if let draft { summary(draft); issues(draft); pages(draft) }
            }.padding()
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(isPresented:$importing,allowedContentTypes:[.pdf,.image],allowsMultipleSelection:false){ result in
            guard case .success(let urls)=result,let url=urls.first else {return}
            Task { await analyze(url) }
        }
    }

    private func analyze(_ url:URL) async {
        analyzing=true;errorMessage=nil
        let scoped=url.startAccessingSecurityScopedResource();defer{if scoped{url.stopAccessingSecurityScopedResource()}}
        do { let value=try await BlueprintAnalysisService.shared.analyze(url:url,projectID:project.id);draft=value;model.saveBlueprintDraft(value) }
        catch { errorMessage="Blueprint analysis could not finish. Reference: AF-BP-103" }
        analyzing=false
    }

    private func summary(_ d:BlueprintEstimateDraft)->some View {
        VStack(alignment:.leading,spacing:12){HStack{VStack(alignment:.leading){Text(d.fileName).font(.headline);Text("\(d.pages.count) analyzed sheets").font(.caption).foregroundStyle(.secondary)};Spacer();Label(d.proposalReady ? "Ready":"Needs review",systemImage:d.proposalReady ? "checkmark.seal.fill":"exclamationmark.triangle.fill").foregroundStyle(d.proposalReady ? .green:.orange)};HStack{metric("Paintable",String(format:"%.0f sf",d.totalPaintableSquareFeet));metric("Labor",String(format:"%.1f hr",d.totalLaborHours));metric("Blocking",String(d.issues.filter{$0.severity == .blocking && !$0.resolved}.count))};Button("Generate Proposal Draft") { model.generateProposal(from:d) }.buttonStyle(.borderedProminent).disabled(!d.proposalReady)}.padding(16).background(.thinMaterial,in:RoundedRectangle(cornerRadius:18))
    }
    private func metric(_ title:String,_ value:String)->some View{VStack(alignment:.leading){Text(title).font(.caption).foregroundStyle(.secondary);Text(value).font(.title3.bold())}.frame(maxWidth:.infinity,alignment:.leading)}
    private func issues(_ d:BlueprintEstimateDraft)->some View { VStack(alignment:.leading,spacing:10){Text("Missing / uncertain information").font(.title2.bold());if d.issues.isEmpty{Label("No blocking gaps found",systemImage:"checkmark.circle.fill").foregroundStyle(.green)}else{ForEach(d.issues){i in HStack(alignment:.top){Image(systemName:i.severity == .blocking ? "exclamationmark.octagon.fill":"exclamationmark.triangle.fill").foregroundStyle(i.severity == .blocking ? .red:.orange);VStack(alignment:.leading){Text("Sheet \(i.pageNumber)").font(.caption.bold());Text(i.message).font(.subheadline)}}.padding(12).background(.thinMaterial,in:RoundedRectangle(cornerRadius:14))}}} }
    private func pages(_ d:BlueprintEstimateDraft)->some View { VStack(alignment:.leading,spacing:12){Text("Sheet deconstruction").font(.title2.bold());ForEach(d.pages){p in DisclosureGroup("Sheet \(p.pageNumber) · \(p.title)"){VStack(alignment:.leading,spacing:8){if let scale=p.drawingScale{Label("Scale: \(scale)",systemImage:"ruler")};if !p.roomNames.isEmpty{Text("Spaces: \(p.roomNames.prefix(8).joined(separator:", "))").font(.caption)};if !p.finishCodes.isEmpty{Text("Finish codes: \(p.finishCodes.joined(separator:", "))").font(.caption)};ForEach(p.quantities){q in HStack{Text(q.scope.rawValue);Spacer();Text("\(q.quantity, specifier:"%.1f") \(q.unit)");if q.needsVerification{Image(systemName:"questionmark.circle").foregroundStyle(.orange)}}.font(.subheadline)}}.padding(.top,8)}.padding(14).background(.thinMaterial,in:RoundedRectangle(cornerRadius:16))}} }
}

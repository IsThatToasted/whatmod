import Foundation
import PDFKit
import Vision
import UIKit

@MainActor
final class BlueprintAnalysisService {
    static let shared = BlueprintAnalysisService()
    private init() {}

    func analyze(url: URL, projectID: UUID) async throws -> BlueprintEstimateDraft {
        let pages: [BlueprintPageAnalysis]
        if url.pathExtension.lowercased() == "pdf" {
            guard let pdf = PDFDocument(url: url) else { throw NSError(domain:"AF-BP",code:101,userInfo:[NSLocalizedDescriptionKey:"Blueprint could not be opened. Reference: AF-BP-101"]) }
            var result:[BlueprintPageAnalysis]=[]
            for index in 0..<pdf.pageCount {
                guard let page=pdf.page(at:index) else { continue }
                let image=render(page:page)
                let text=try await recognize(image:image)
                result.append(analyzeText(text,pageNumber:index+1))
            }
            pages=result
        } else {
            guard let image=UIImage(contentsOfFile:url.path) else { throw NSError(domain:"AF-BP",code:102,userInfo:[NSLocalizedDescriptionKey:"Plan image could not be opened. Reference: AF-BP-102"]) }
            pages=[analyzeText(try await recognize(image:image),pageNumber:1)]
        }
        let issues=pages.flatMap(\.issues)
        let quantities=pages.flatMap(\.quantities)
        let paintable=quantities.filter{$0.scope == .walls || $0.scope == .ceiling}.reduce(0){$0+$1.quantity}
        let hours=quantities.reduce(0){partial,q in
            switch q.scope {
            case .walls: return partial + q.quantity/150
            case .ceiling: return partial + q.quantity/125
            case .trim: return partial + q.quantity/50
            case .doors,.windows: return partial + q.quantity/2
            }
        }
        return BlueprintEstimateDraft(projectID:projectID,fileName:url.lastPathComponent,pages:pages,issues:issues,proposalReady:!issues.contains{$0.severity == .blocking && !$0.resolved},totalPaintableSquareFeet:paintable,totalLaborHours:hours)
    }

    private func render(page: PDFPage) -> UIImage {
        let bounds=page.bounds(for:.mediaBox)
        let scale=min(3.0,max(1.5,2400/max(bounds.width,bounds.height)))
        let size=CGSize(width:bounds.width*scale,height:bounds.height*scale)
        let renderer=UIGraphicsImageRenderer(size:size)
        return renderer.image { ctx in
            UIColor.white.setFill(); ctx.fill(CGRect(origin:.zero,size:size))
            ctx.cgContext.saveGState(); ctx.cgContext.scaleBy(x:scale,y:scale)
            page.draw(with:.mediaBox,to:ctx.cgContext); ctx.cgContext.restoreGState()
        }
    }

    private func recognize(image: UIImage) async throws -> String {
        guard let cg=image.cgImage else { return "" }
        return try await withCheckedThrowingContinuation { continuation in
            let request=VNRecognizeTextRequest { request,error in
                if let error { continuation.resume(throwing:error); return }
                let strings=(request.results as? [VNRecognizedTextObservation] ?? []).compactMap{$0.topCandidates(1).first?.string}
                continuation.resume(returning:strings.joined(separator:"\n"))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.customWords = ["GWB","ACT","PT","PNT","PAINT","FINISH","SCHEDULE","BASE","WALL","CEILING","DOOR","WINDOW","ELEVATION"]
            DispatchQueue.global(qos:.userInitiated).async {
                do { try VNImageRequestHandler(cgImage:cg,options:[:]).perform([request]) }
                catch { continuation.resume(throwing:error) }
            }
        }
    }

    private func analyzeText(_ text:String,pageNumber:Int)->BlueprintPageAnalysis {
        let upper=text.uppercased()
        let lines=text.components(separatedBy:.newlines).map{$0.trimmingCharacters(in:.whitespaces)}.filter{!$0.isEmpty}
        let title=lines.first(where:{$0.count<70}) ?? "Sheet \(pageNumber)"
        let scale=extractScale(from:upper)
        let rooms=extractRooms(lines)
        let finishes=extractFinishCodes(lines)
        let ceilingHeight = extractCeilingHeight(lines)
        let roomDimensions = extractRoomDimensions(lines)
        var quantities:[BlueprintQuantity]=[]
        var issues:[BlueprintIssue]=[]

        // Prefer explicit labeled areas. When room dimensions are printed on the plan,
        // Aurelium can also derive ceiling area and wall gross area (only when a height is supported).
        let sfRegex=try? NSRegularExpression(pattern:"(?:AREA|WALL|CEILING|ROOM|PAINT)[^\\n]{0,50}?([0-9]{2,6}(?:\\.[0-9]+)?)\\s*(?:SF|SQ\\.?\\s*FT|SQFT)",options:[.caseInsensitive])
        for line in lines {
            guard let sfRegex, let match=sfRegex.firstMatch(in:line,range:NSRange(line.startIndex...,in:line)), match.numberOfRanges>1,
                  let r=Range(match.range(at:1),in:line), let value=Double(line[r]) else { continue }
            let isCeiling=line.uppercased().contains("CEIL")
            quantities.append(BlueprintQuantity(pageNumber:pageNumber,sourceLabel:line,scope:isCeiling ? .ceiling:.walls,quantity:value,unit:"sq ft",confidence:0.88,evidence:line,needsVerification:false))
        }
        for room in roomDimensions {
            let ceilingArea = room.lengthFeet * room.widthFeet
            quantities.append(BlueprintQuantity(pageNumber: pageNumber, sourceLabel: room.label, scope: .ceiling, quantity: ceilingArea, unit: "sq ft", confidence: 0.78, evidence: "Printed room dimensions: \(room.label)", needsVerification: true))
            if let ceilingHeight {
                let grossWalls = 2 * (room.lengthFeet + room.widthFeet) * ceilingHeight
                quantities.append(BlueprintQuantity(pageNumber: pageNumber, sourceLabel: room.label, scope: .walls, quantity: grossWalls, unit: "sq ft", confidence: 0.72, evidence: "Perimeter × printed ceiling height; openings not yet deducted", needsVerification: true))
            }
        }
        if !roomDimensions.isEmpty && ceilingHeight == nil {
            issues.append(BlueprintIssue(pageNumber: pageNumber, severity: .blocking, message: "Room dimensions were found, but no reliable wall/ceiling height was identified for wall-area calculation."))
        }
        if !roomDimensions.isEmpty && ceilingHeight != nil {
            issues.append(BlueprintIssue(pageNumber: pageNumber, severity: .warning, message: "Derived wall quantities are gross perimeter × height. Verify door/window deductions before final proposal."))
        }

        let doorCount=countScheduleRows(lines,keywords:["DOOR","DR "])
        if doorCount>0 { quantities.append(BlueprintQuantity(pageNumber:pageNumber,sourceLabel:"Door schedule",scope:.doors,quantity:Double(doorCount),unit:"doors",confidence:0.68,evidence:"Schedule-like door rows detected",needsVerification:true)) }
        let windowCount=countScheduleRows(lines,keywords:["WINDOW","WIN "])
        if windowCount>0 { quantities.append(BlueprintQuantity(pageNumber:pageNumber,sourceLabel:"Window schedule",scope:.windows,quantity:Double(windowCount),unit:"windows",confidence:0.68,evidence:"Schedule-like window rows detected",needsVerification:true)) }

        if scale == nil && upper.contains("FLOOR PLAN") { issues.append(BlueprintIssue(pageNumber:pageNumber,severity:.blocking,message:"No drawing scale was confidently identified on this plan sheet.")) }
        if upper.contains("FINISH") && finishes.isEmpty { issues.append(BlueprintIssue(pageNumber:pageNumber,severity:.warning,message:"A finish schedule appears to be present, but finish codes could not be confidently resolved.")) }
        if quantities.isEmpty && (upper.contains("FLOOR PLAN") || upper.contains("ELEVATION")) { issues.append(BlueprintIssue(pageNumber:pageNumber,severity:.blocking,message:"No explicit paintable area or reliable dimensions were extracted. Verify scale/dimensions before proposal generation.")) }
        if !upper.contains("PAINT") && !upper.contains("PNT") && upper.contains("FINISH") { issues.append(BlueprintIssue(pageNumber:pageNumber,severity:.warning,message:"Finish information was found but paint scope is not explicit on this sheet.")) }

        return BlueprintPageAnalysis(pageNumber:pageNumber,title:title,recognizedText:text,drawingScale:scale,roomNames:rooms,finishCodes:finishes,quantities:quantities,issues:issues)
    }

    private func extractScale(from text:String)->String? {
        let patterns=["SCALE[: ]+([0-9/\\\"'= -]+)","([0-9]+/[0-9]+)\\\"\\s*=\\s*1['’]-0\\\""]
        for p in patterns { if let re=try? NSRegularExpression(pattern:p,options:[.caseInsensitive]),let m=re.firstMatch(in:text,range:NSRange(text.startIndex...,in:text)),m.numberOfRanges>1,let r=Range(m.range(at:1),in:text){return String(text[r]).trimmingCharacters(in:.whitespaces)} }
        return nil
    }

    private func extractRooms(_ lines:[String])->[String] {
        let keys=["ROOM","OFFICE","BEDROOM","KITCHEN","CORRIDOR","LOBBY","BATH","TOILET","CLASSROOM","HALL"]
        var found:[String]=[]
        for line in lines where line.count<55 {
            let u=line.uppercased(); if keys.contains(where:{u.contains($0)}) && !u.contains("SCHEDULE") && !u.contains("NOTE") { found.append(line) }
        }
        return Array(found.prefix(30))
    }

    private func extractFinishCodes(_ lines:[String])->[String] {
        let re=try? NSRegularExpression(pattern:"\\b(?:PT|PNT|PAINT)[- ]?[A-Z0-9]{1,5}\\b",options:[.caseInsensitive])
        var set=Set<String>()
        for line in lines { guard let re else {continue}; for m in re.matches(in:line,range:NSRange(line.startIndex...,in:line)){if let r=Range(m.range,in:line){set.insert(String(line[r]).uppercased())}} }
        return set.sorted()
    }

    private func extractCeilingHeight(_ lines:[String]) -> Double? {
        let keys = ["CEILING HEIGHT", "CLG HGT", "CLG. HGT", "CEIL HGT", "WALL HEIGHT"]
        for line in lines where keys.contains(where: { line.uppercased().contains($0) }) {
            if let value = firstArchitecturalLength(in: line) { return value }
        }
        return nil
    }

    private func extractRoomDimensions(_ lines:[String]) -> [(label:String,lengthFeet:Double,widthFeet:Double)] {
        let roomKeys = ["ROOM","OFFICE","BEDROOM","KITCHEN","CORRIDOR","LOBBY","BATH","TOILET","CLASSROOM","HALL","DINING","LIVING"]
        var result:[(String,Double,Double)] = []
        for line in lines where roomKeys.contains(where: { line.uppercased().contains($0) }) {
            let lengths = architecturalLengths(in: line)
            if lengths.count >= 2, lengths[0] > 2, lengths[1] > 2 {
                result.append((line, lengths[0], lengths[1]))
            }
        }
        return Array(result.prefix(40))
    }

    private func architecturalLengths(in text:String) -> [Double] {
        let pattern = #"(\d{1,3})\s*['’]\s*(?:(\d{1,2})(?:\s*(?:\"|”))?)?"#
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        return re.matches(in:text,range:NSRange(text.startIndex...,in:text)).compactMap { match in
            guard let fr=Range(match.range(at:1),in:text), let feet=Double(text[fr]) else { return nil }
            var inches=0.0
            if match.range(at:2).location != NSNotFound, let ir=Range(match.range(at:2),in:text) { inches=Double(text[ir]) ?? 0 }
            return feet + inches/12
        }
    }

    private func firstArchitecturalLength(in text:String) -> Double? { architecturalLengths(in:text).first }

    private func countScheduleRows(_ lines:[String],keywords:[String])->Int {
        lines.filter { line in let u=line.uppercased(); return u.count<120 && keywords.contains(where:{u.contains($0)}) && u.range(of:"[0-9]",options:.regularExpression) != nil }.count
    }
}

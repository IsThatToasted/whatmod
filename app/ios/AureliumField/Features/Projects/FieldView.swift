import SwiftUI
struct FieldView: View { var body: some View { List { Label("Photos & progress",systemImage:"camera");Label("Time & cost codes",systemImage:"clock");Label("Daily log",systemImage:"list.clipboard");Label("Punch & quality",systemImage:"checkmark.circle");Label("Plans & documents",systemImage:"doc.on.doc");Label("Safety",systemImage:"cross.case") }.navigationTitle("Field") } }

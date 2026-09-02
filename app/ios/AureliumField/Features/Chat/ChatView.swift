import SwiftUI

private struct ChatConversation: Codable, Identifiable, Hashable {
    let id: UUID
    let organizationID: UUID
    let projectID: UUID?
    let kind: String
    let title: String?
    let audience: String?
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, kind, title, audience
        case organizationID = "organization_id"
        case projectID = "project_id"
        case updatedAt = "updated_at"
    }
}

private struct ChatMessage: Codable, Identifiable, Hashable {
    let id: UUID
    let conversationID: UUID
    let senderID: UUID
    let replyToID: UUID?
    let body: String
    let editedAt: Date?
    let deletedAt: Date?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, body
        case conversationID = "conversation_id"
        case senderID = "sender_id"
        case replyToID = "reply_to_id"
        case editedAt = "edited_at"
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
    }
}

private struct ChatDirectoryMember: Codable, Identifiable, Hashable {
    let userID: UUID
    let displayName: String?
    let email: String?
    var id: UUID { userID }
    enum CodingKeys: String, CodingKey { case userID = "user_id"; case displayName = "display_name"; case email }
    var label: String { let trimmed = displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""; return trimmed.isEmpty ? (email ?? "Teammate") : trimmed }
}

struct ChatView: View {
    @State private var cloud = WorkspaceService.shared
    @State private var conversations: [ChatConversation] = []
    @State private var people: [ChatDirectoryMember] = []
    @State private var selected: ChatConversation?
    @State private var errorReference: String?
    @State private var showingCreate = false
    @State private var search = ""

    private var filtered: [ChatConversation] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return conversations }
        return conversations.filter { ($0.title ?? "Direct message").localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                searchField
                if let errorReference { errorBanner(errorReference) }
                if filtered.isEmpty { emptyState }
                else { conversationSections }
            }
            .padding()
        }
        .navigationTitle("Chat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingCreate = true } label: { Image(systemName: "square.and.pencil") }
            }
        }
        .navigationDestination(item: $selected) { conversation in
            ConversationView(conversation: conversation, people: people)
        }
        .sheet(isPresented: $showingCreate) {
            NewConversationView(people: people, isAdmin: cloud.isAdmin) { request in
                await createConversation(request)
            }
        }
        .task { await reload() }
        .refreshable { await reload() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("TEAM COMMUNICATION").font(.caption2.bold()).tracking(1.2).foregroundStyle(.secondary)
                Text("Stay connected to the work.").font(.title2.bold())
                Text("Channels, crew groups and direct messages in one workspace.").font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Button { showingCreate = true } label: {
                Image(systemName: "plus").font(.headline).frame(width: 42, height: 42)
            }
            .buttonStyle(.borderedProminent)
            .clipShape(Circle())
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("Search chats", text: $search)
        }
        .padding(.horizontal, 14).frame(height: 46)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 14))
    }

    private var conversationSections: some View {
        VStack(alignment: .leading, spacing: 14) {
            let channels = filtered.filter { $0.kind == "channel" }
            let groups = filtered.filter { $0.kind == "group" }
            let directs = filtered.filter { $0.kind == "direct" }
            if !channels.isEmpty { conversationGroup("Channels", rows: channels) }
            if !groups.isEmpty { conversationGroup("Groups", rows: groups) }
            if !directs.isEmpty { conversationGroup("Direct messages", rows: directs) }
        }
    }

    private func conversationGroup(_ title: String, rows: [ChatConversation]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(.caption2.bold()).tracking(1.1).foregroundStyle(.secondary)
            VStack(spacing: 0) {
                ForEach(rows) { conversation in
                    Button { selected = conversation } label: { ChatConversationRow(conversation: conversation) }
                        .buttonStyle(.plain)
                    if conversation.id != rows.last?.id { Divider().padding(.leading, 58) }
                }
            }
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
        }
    }

    private var emptyState: some View {
        ContentUnavailableView("No chats yet", systemImage: "bubble.left.and.bubble.right.fill", description: Text("Create a channel, crew group, or direct message to get started."))
            .padding(.vertical, 40)
    }

    private func errorBanner(_ reference: String) -> some View {
        Label("Chat could not update. Reference: \(reference)", systemImage: "exclamationmark.triangle.fill")
            .font(.caption).foregroundStyle(.secondary).padding(12)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }

    private func reload() async {
        await loadDirectory()
        await loadConversations()
    }

    private func loadDirectory() async {
        guard let organizationID = cloud.organizationID else { return }
        struct Params: Encodable { let p_organization_id: UUID }
        do {
            people = try await cloud.rpcValue("chat_list_members", params: Params(p_organization_id: organizationID), as: [ChatDirectoryMember].self)
        } catch { /* names are enrichment only */ }
    }

    private func loadConversations() async {
        guard let organizationID = cloud.organizationID else { return }
        do {
            conversations = try await cloud.selectRows(table: "chat_conversations", columns: "id,organization_id,project_id,kind,title,audience,updated_at", filters: [CloudFilter("organization_id", organizationID.uuidString)], order: "updated_at.desc", limit: 100)
            errorReference = nil
        } catch { errorReference = "AF-CHAT-101" }
    }

    private func createConversation(_ request: NewConversationRequest) async -> Bool {
        guard let organizationID = cloud.organizationID else { return false }
        struct Params: Encodable {
            let p_organization_id: UUID
            let p_title: String
            let p_kind: String
            let p_project_id: UUID?
            let p_audience: String
            let p_member_ids: [UUID]
        }
        do {
            let id: UUID = try await cloud.rpcValue("chat_create_conversation", params: Params(p_organization_id: organizationID, p_title: request.title, p_kind: request.kind, p_project_id: nil, p_audience: request.audience, p_member_ids: request.memberIDs), as: UUID.self)
            await loadConversations()
            selected = conversations.first(where: { $0.id == id })
            errorReference = nil
            return true
        } catch {
            errorReference = "AF-CHAT-CREATE"
            return false
        }
    }
}

private struct ChatConversationRow: View {
    let conversation: ChatConversation
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(.quaternary).frame(width: 42, height: 42)
                Image(systemName: icon).font(.headline)
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(conversation.title ?? "Direct message").font(.headline).lineLimit(1)
                    if conversation.audience == "admins" { Image(systemName: "lock.fill").font(.caption2).foregroundStyle(.secondary) }
                }
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(conversation.updatedAt.formatted(date: .omitted, time: .shortened)).font(.caption2).foregroundStyle(.tertiary)
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
        }
        .padding(12)
    }
    private var icon: String { conversation.kind == "channel" ? "number" : (conversation.kind == "direct" ? "person.fill" : "person.3.fill") }
    private var subtitle: String { if conversation.audience == "admins" { return "Admins only" }; if conversation.audience == "members" { return "Private group" }; return conversation.kind == "channel" ? "Organization channel" : conversation.kind.capitalized }
}

private struct NewConversationRequest { var title: String; var kind: String; var audience: String; var memberIDs: [UUID] }

private struct NewConversationView: View {
    let people: [ChatDirectoryMember]
    let isAdmin: Bool
    let onCreate: (NewConversationRequest) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var mode = "channel"
    @State private var title = ""
    @State private var audience = "organization"
    @State private var selectedMembers = Set<UUID>()
    @State private var creating = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Conversation type") {
                    Picker("Type", selection: $mode) { Text("Channel").tag("channel"); Text("Group").tag("group"); Text("Direct").tag("direct") }
                        .pickerStyle(.segmented)
                }
                Section("Details") {
                    TextField(mode == "channel" ? "Channel name" : mode == "group" ? "Group name" : "Direct message", text: $title)
                    if mode != "direct" {
                        Picker("Who can access", selection: $audience) {
                            Text("Everyone").tag("organization")
                            Text("Selected members").tag("members")
                            if isAdmin { Text("Admins only").tag("admins") }
                        }
                    }
                }
                if audience == "members" || mode == "group" || mode == "direct" {
                    Section(mode == "direct" ? "Choose teammate" : "Invite members") {
                        ForEach(people) { person in
                            Button {
                                if mode == "direct" { selectedMembers = [person.id]; title = person.label }
                                else if selectedMembers.contains(person.id) { selectedMembers.remove(person.id) } else { selectedMembers.insert(person.id) }
                            } label: {
                                HStack { Circle().fill(.quaternary).frame(width: 32, height: 32).overlay(Text(String(person.label.prefix(1))).font(.caption.bold())); VStack(alignment: .leading) { Text(person.label); if let email = person.email { Text(email).font(.caption).foregroundStyle(.secondary) } }; Spacer(); if selectedMembers.contains(person.id) { Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint) } }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                if isAdmin {
                    Section { Label("Admin-only channels are hidden from employees and remain available to organization owners/admins.", systemImage: "lock.shield.fill").font(.caption).foregroundStyle(.secondary) }
                }
            }
            .navigationTitle("New Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(creating ? "Creating…" : "Create") { Task { await create() } }.disabled(!canCreate || creating) }
            }
            .onChange(of: mode) { _, newValue in
                if newValue == "group" { audience = "members" }
                if newValue == "direct" { audience = "members"; selectedMembers.removeAll() }
            }
        }
    }

    private var canCreate: Bool {
        let hasTitle = !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        if mode == "direct" { return selectedMembers.count == 1 }
        if mode == "group" || audience == "members" { return hasTitle && !selectedMembers.isEmpty }
        return hasTitle
    }

    private func create() async {
        creating = true
        let ok = await onCreate(NewConversationRequest(title: title.trimmingCharacters(in: .whitespacesAndNewlines), kind: mode, audience: mode == "channel" ? audience : "members", memberIDs: Array(selectedMembers)))
        creating = false
        if ok { dismiss() }
    }
}

private struct ConversationView: View {
    let conversation: ChatConversation
    let people: [ChatDirectoryMember]
    @State private var cloud = WorkspaceService.shared
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var replyTo: ChatMessage?
    @State private var errorReference: String?

    private var names: [UUID: String] { people.reduce(into: [:]) { result, person in result[person.userID] = person.label } }

    var body: some View {
        VStack(spacing: 0) {
            threadHeader
            Divider()
            messageList
            composer
        }
        .navigationTitle(conversation.title ?? "Chat")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: conversation.id) {
            await refresh()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(6))
                guard !Task.isCancelled else { break }
                await refresh()
            }
        }
        .overlay(alignment: .top) { if let errorReference { Text("Reference: \(errorReference)").font(.caption).padding(8).background(.thinMaterial, in: Capsule()).padding() } }
    }

    private var threadHeader: some View {
        HStack(spacing: 10) {
            Image(systemName: conversation.kind == "channel" ? "number" : "person.3.fill").frame(width: 34, height: 34).background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 1) { Text(conversation.title ?? "Direct message").font(.headline); Text(conversation.audience == "admins" ? "Admins only" : conversation.audience == "members" ? "Private conversation" : "Organization conversation").font(.caption).foregroundStyle(.secondary) }
            Spacer()
        }
        .padding(.horizontal).padding(.vertical, 10)
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(messages) { message in
                        MessageRow(message: message, isCurrentUser: message.senderID == cloud.userID, senderName: names[message.senderID] ?? "Teammate", repliedMessage: messages.first(where: { $0.id == message.replyToID }))
                            .id(message.id)
                            .contextMenu { Button { replyTo = message } label: { Label("Reply", systemImage: "arrowshape.turn.up.left") }; Button { UIPasteboard.general.string = message.body } label: { Label("Copy", systemImage: "doc.on.doc") } }
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) { _, _ in if let id = messages.last?.id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } } }
        }
    }

    private var composer: some View {
        VStack(spacing: 0) {
            if let replyTo {
                HStack { Image(systemName: "arrowshape.turn.up.left.fill"); VStack(alignment: .leading) { Text("Replying to \(names[replyTo.senderID] ?? "teammate")").font(.caption.bold()); Text(replyTo.body).font(.caption).foregroundStyle(.secondary).lineLimit(1) }; Spacer(); Button { self.replyTo = nil } label: { Image(systemName: "xmark.circle.fill") } }
                    .padding(.horizontal).padding(.vertical, 8).background(.quaternary)
            }
            HStack(alignment: .bottom, spacing: 10) {
                Button { } label: { Image(systemName: "plus.circle.fill").font(.title2).foregroundStyle(.secondary) }
                TextField("Message \(conversation.title ?? "conversation")", text: $draft, axis: .vertical).lineLimit(1...5).padding(.horizontal, 12).padding(.vertical, 9).background(.quaternary, in: RoundedRectangle(cornerRadius: 16))
                Button { Task { await send() } } label: { Image(systemName: "arrow.up.circle.fill").font(.title) }.disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
        }
        .background(.ultraThinMaterial)
    }

    private func refresh() async {
        do { messages = try await cloud.selectRows(table: "chat_messages", columns: "id,conversation_id,sender_id,reply_to_id,body,edited_at,deleted_at,created_at", filters: [CloudFilter("conversation_id", conversation.id.uuidString)], order: "created_at.asc", limit: 400); errorReference = nil }
        catch { errorReference = "AF-CHAT-103" }
    }

    private func send() async {
        guard let organizationID = cloud.organizationID, let userID = cloud.userID else { return }
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines); guard !text.isEmpty else { return }
        struct MessageInsert: Encodable { let conversation_id: UUID; let organization_id: UUID; let sender_id: UUID; let reply_to_id: UUID?; let body: String }
        draft = ""
        let replyID = replyTo?.id
        replyTo = nil
        do { try await cloud.insertRecord(table: "chat_messages", payload: MessageInsert(conversation_id: conversation.id, organization_id: organizationID, sender_id: userID, reply_to_id: replyID, body: text)); await refresh(); errorReference = nil }
        catch { draft = text; errorReference = "AF-CHAT-104" }
    }
}

private struct MessageRow: View {
    let message: ChatMessage
    let isCurrentUser: Bool
    let senderName: String
    let repliedMessage: ChatMessage?
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isCurrentUser { Spacer(minLength: 52) }
            if !isCurrentUser { Circle().fill(.quaternary).frame(width: 32, height: 32).overlay(Text(String(senderName.prefix(1))).font(.caption.bold())) }
            VStack(alignment: isCurrentUser ? .trailing : .leading, spacing: 4) {
                HStack(spacing: 6) { if !isCurrentUser { Text(senderName).font(.caption.bold()) }; Text(message.createdAt.formatted(date: .omitted, time: .shortened)).font(.caption2).foregroundStyle(.secondary) }
                VStack(alignment: .leading, spacing: 6) {
                    if let repliedMessage { Text("↳ \(repliedMessage.body)").font(.caption).foregroundStyle(.secondary).lineLimit(2).padding(.bottom, 2) }
                    Text(message.deletedAt == nil ? message.body : "Message deleted").foregroundStyle(message.deletedAt == nil ? .primary : .secondary)
                }
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(isCurrentUser ? Color.accentColor.opacity(0.18) : Color.secondary.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
            }
            if !isCurrentUser { Spacer(minLength: 52) }
        }
    }
}

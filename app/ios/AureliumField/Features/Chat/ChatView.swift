import SwiftUI

private struct ChatConversation: Codable, Identifiable, Hashable {
    let id: UUID
    let organizationID: UUID
    let projectID: UUID?
    let kind: String
    let title: String?
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, kind, title
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

struct ChatView: View {
    @State private var cloud = WorkspaceService.shared
    @State private var conversations: [ChatConversation] = []
    @State private var selected: ChatConversation?
    @State private var errorReference: String?
    @State private var showingNewChannel = false
    @State private var newChannelName = ""

    var body: some View {
        List {
            if let errorReference {
                Section {
                    Label(
                        "Chat could not update. Reference: \(errorReference)",
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(.secondary)
                }
            }

            Section("Conversations") {
                if conversations.isEmpty {
                    ContentUnavailableView(
                        "No conversations yet",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Create a team channel to start coordinating.")
                    )
                }

                ForEach(conversations) { conversation in
                    Button {
                        selected = conversation
                    } label: {
                        ChatConversationRow(conversation: conversation)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationTitle("Chat")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingNewChannel = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .navigationDestination(item: $selected) { conversation in
            ConversationView(conversation: conversation)
        }
        .task {
            await loadConversations()
        }
        .alert("New Channel", isPresented: $showingNewChannel) {
            TextField("Channel name", text: $newChannelName)
            Button("Create") {
                Task { await createChannel() }
            }
            .disabled(newChannelName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            Button("Cancel", role: .cancel) {
                newChannelName = ""
            }
        }
    }

    private func loadConversations() async {
        guard let organizationID = cloud.organizationID else { return }
        do {
            let rows: [ChatConversation] = try await cloud.selectRows(
                table: "chat_conversations",
                columns: "id,organization_id,project_id,kind,title,updated_at",
                filters: [CloudFilter("organization_id", organizationID.uuidString)],
                order: "updated_at.desc",
                limit: 100
            )
            conversations = rows
        } catch {
            errorReference = "AF-CHAT-101"
        }
    }

    private func createChannel() async {
        guard let organizationID = cloud.organizationID,
              let userID = cloud.userID else { return }

        let name = newChannelName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }

        struct ConversationInsert: Encodable {
            let organization_id: UUID
            let kind: String
            let title: String
            let created_by: UUID
        }
        struct IDRow: Decodable { let id: UUID }
        struct MemberInsert: Encodable {
            let conversation_id: UUID
            let organization_id: UUID
            let user_id: UUID
        }

        do {
            let row: IDRow = try await cloud.insertReturning(
                table: "chat_conversations",
                payload: ConversationInsert(
                    organization_id: organizationID,
                    kind: "channel",
                    title: name,
                    created_by: userID
                ),
                columns: "id",
                as: IDRow.self
            )
            try await cloud.insertRecord(
                table: "chat_members",
                payload: MemberInsert(
                    conversation_id: row.id,
                    organization_id: organizationID,
                    user_id: userID
                )
            )
            newChannelName = ""
            await loadConversations()
        } catch {
            errorReference = "AF-CHAT-102"
        }
    }
}

private struct ChatConversationRow: View {
    let conversation: ChatConversation

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: conversation.kind == "channel" ? "number" : "person.2.fill")
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(conversation.title ?? "Direct message")
                    .font(.headline)
                Text(conversation.kind.capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
    }
}

private struct ConversationView: View {
    let conversation: ChatConversation

    @State private var cloud = WorkspaceService.shared
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var errorReference: String?

    var body: some View {
        VStack(spacing: 0) {
            messageList
            Divider()
            composer
        }
        .navigationTitle(conversation.title ?? "Chat")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: conversation.id) {
            await refresh()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 8_000_000_000)
                guard !Task.isCancelled else { break }
                await refresh()
            }
        }
        .overlay(alignment: .top) {
            if let errorReference {
                Text("Reference: \(errorReference)")
                    .font(.caption)
                    .padding(8)
                    .background(.thinMaterial, in: Capsule())
                    .padding()
            }
        }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    ForEach(messages) { message in
                        MessageRow(message: message, isCurrentUser: message.senderID == cloud.userID)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) { _, _ in
                guard let id = messages.last?.id else { return }
                withAnimation {
                    proxy.scrollTo(id, anchor: .bottom)
                }
            }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField(
                "Message \(conversation.title ?? "conversation")",
                text: $draft,
                axis: .vertical
            )
            .lineLimit(1...5)
            .textFieldStyle(.roundedBorder)

            Button {
                Task { await send() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding()
    }

    private func refresh() async {
        do {
            let rows: [ChatMessage] = try await cloud.selectRows(
                table: "chat_messages",
                columns: "id,conversation_id,sender_id,reply_to_id,body,edited_at,deleted_at,created_at",
                filters: [CloudFilter("conversation_id", conversation.id.uuidString)],
                order: "created_at.asc",
                limit: 300
            )
            messages = rows
        } catch {
            errorReference = "AF-CHAT-103"
        }
    }

    private func send() async {
        guard let organizationID = cloud.organizationID,
              let userID = cloud.userID else { return }

        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        struct MessageInsert: Encodable {
            let conversation_id: UUID
            let organization_id: UUID
            let sender_id: UUID
            let body: String
        }

        draft = ""
        do {
            try await cloud.insertRecord(
                table: "chat_messages",
                payload: MessageInsert(
                    conversation_id: conversation.id,
                    organization_id: organizationID,
                    sender_id: userID,
                    body: text
                )
            )
            await refresh()
        } catch {
            draft = text
            errorReference = "AF-CHAT-104"
        }
    }
}

private struct MessageRow: View {
    let message: ChatMessage
    let isCurrentUser: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(.quaternary)
                .frame(width: 34, height: 34)
                .overlay {
                    Text(String(message.senderID.uuidString.prefix(1)))
                        .font(.caption.bold())
                }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(isCurrentUser ? "You" : "Teammate")
                        .font(.caption.bold())
                    Text(message.createdAt.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if message.deletedAt == nil {
                    Text(message.body)
                } else {
                    Text("Message deleted")
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 24)
        }
    }
}

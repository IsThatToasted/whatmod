import { useEffect, useMemo, useState } from 'react';
import { Hash, MessageCircle, Plus, Search, Send, SmilePlus, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import { supabase } from '../lib/supabase';

type Conversation = {
  id: string;
  organization_id: string;
  project_id: string | null;
  kind: 'direct' | 'group' | 'channel';
  title: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

type Member = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

export function Chat() {
  const { membership, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [people, setPeople] = useState<Member[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const names = useMemo(
    () => new Map(people.map((person) => [person.user_id, person.display_name || person.email || 'Teammate'])),
    [people],
  );
  const selected = conversations.find((conversation) => conversation.id === active) ?? null;
  const filtered = conversations.filter((conversation) =>
    (conversation.title || 'Direct message').toLowerCase().includes(search.toLowerCase()),
  );

  const loadDirectory = async () => {
    const client = supabase;
    if (!client || !membership) return;

    const { data, error: directoryError } = await client.rpc('chat_list_members', {
      p_organization_id: membership.organization_id,
    });

    // Directory names are enrichment only. A directory problem must never make
    // the conversation list unusable for an otherwise-authorized employee.
    if (!directoryError) setPeople((data || []) as Member[]);
  };

  const loadConversations = async () => {
    const client = supabase;
    if (!client || !membership) return;

    const { data, error: conversationError } = await client
      .from('chat_conversations')
      .select('id,organization_id,project_id,kind,title,updated_at')
      .eq('organization_id', membership.organization_id)
      .order('updated_at', { ascending: false });

    if (conversationError) {
      setError('AF-CHAT-101');
      return;
    }

    const rows = (data || []) as Conversation[];
    setConversations(rows);
    setError('');
    setActive((current) => {
      if (current && rows.some((conversation) => conversation.id === current)) return current;
      return rows[0]?.id ?? null;
    });
    void loadDirectory();
  };

  const loadMessages = async (conversationID: string) => {
    const client = supabase;
    if (!client) return;

    const { data, error: historyError } = await client
      .from('chat_messages')
      .select('id,conversation_id,sender_id,reply_to_id,body,edited_at,deleted_at,created_at')
      .eq('conversation_id', conversationID)
      .order('created_at', { ascending: true })
      .limit(300);

    if (historyError) {
      setError('AF-CHAT-103');
      return;
    }

    setMessages((data || []) as Message[]);
    setError('');
  };

  useEffect(() => {
    void loadConversations();
    // The active organization is the only identity input needed for this reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership?.organization_id]);

  useEffect(() => {
    const client = supabase;
    if (!active || !client) {
      setMessages([]);
      return;
    }

    void loadMessages(active);
    const channel = client
      .channel(`chat:${active}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${active}` },
        () => void loadMessages(active),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [active]);

  const send = async () => {
    const client = supabase;
    if (!client || !membership || !user || !active || !draft.trim()) return;

    const body = draft.trim();
    setDraft('');
    const { error: sendError } = await client.from('chat_messages').insert({
      conversation_id: active,
      organization_id: membership.organization_id,
      sender_id: user.id,
      body,
    });

    if (sendError) {
      setDraft(body);
      setError('AF-CHAT-104');
      return;
    }

    setError('');
    void loadMessages(active);
    void loadConversations();
  };

  const createChannel = async () => {
    const client = supabase;
    if (!client || !membership || !user) return;

    const title = prompt('Channel name');
    if (!title?.trim()) return;

    const { data, error: createError } = await client.rpc('chat_create_channel', {
      p_organization_id: membership.organization_id,
      p_title: title.trim(),
      p_project_id: null,
    });

    if (createError || typeof data !== 'string') {
      setError('AF-CHAT-102');
      return;
    }

    await loadConversations();
    setActive(data);
    setError('');
  };

  return (
    <div className="page chat-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team communication</p>
          <h1>Chat</h1>
          <p>Direct messages, project conversations, channels, replies and field coordination in one organization-scoped workspace.</p>
        </div>
        <button className="button primary" onClick={createChannel}>
          <Plus size={17} />
          New channel
        </button>
      </header>

      {error && <div className="error-banner">Something went wrong. Reference {error}.</div>}

      <div className="chat-shell">
        <aside className="chat-list panel">
          <div className="chat-search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" />
          </div>

          {filtered.length === 0 ? (
            <div className="compact-empty">
              <MessageCircle />
              <strong>No conversations yet</strong>
              <span>Create a channel to start coordinating.</span>
            </div>
          ) : (
            filtered.map((conversation) => (
              <button
                key={conversation.id}
                className={active === conversation.id ? 'chat-conversation active' : 'chat-conversation'}
                onClick={() => setActive(conversation.id)}
              >
                {conversation.kind === 'channel' ? <Hash size={18} /> : <Users size={18} />}
                <div>
                  <strong>{conversation.title || 'Direct message'}</strong>
                  <span>{conversation.kind}</span>
                </div>
              </button>
            ))
          )}
        </aside>

        <section className="chat-thread panel">
          {selected ? (
            <>
              <div className="chat-thread-head">
                <div>
                  <strong>{selected.title || 'Direct message'}</strong>
                  <span>{selected.kind === 'channel' ? 'Organization channel' : 'Team conversation'}</span>
                </div>
              </div>

              <div className="chat-messages">
                {messages.map((message) => (
                  <div className="chat-message" key={message.id}>
                    <div className="chat-avatar">{(names.get(message.sender_id) || '?')[0]}</div>
                    <div>
                      <div className="chat-meta">
                        <strong>{names.get(message.sender_id) || 'Teammate'}</strong>
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                      <p>{message.deleted_at ? 'Message deleted' : message.body}</p>
                      <button className="chat-react" aria-label="React">
                        <SmilePlus size={14} />
                        React
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="chat-compose">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={`Message ${selected.title || 'conversation'}`}
                />
                <button className="icon-button chat-send" disabled={!draft.trim()} onClick={() => void send()} aria-label="Send">
                  <Send size={19} />
                </button>
              </div>
            </>
          ) : (
            <div className="compact-empty">
              <MessageCircle />
              <strong>Select a conversation</strong>
              <span>Your messages will appear here.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

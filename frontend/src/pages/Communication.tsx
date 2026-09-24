import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function Communication() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    api.get('/communication/channels/mine').then((r) => setChannels(r.data));
  }, []);

  const openChannel = (id: string) => {
    setActive(id);
    api.get(`/communication/channels/${id}/messages`).then((r) => setMessages(r.data));
  };

  const send = async () => {
    if (!active || !text.trim()) return;
    await api.post(`/communication/channels/${active}/messages`, { body: text });
    setText('');
    openChannel(active);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.communication')}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 md:col-span-1">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-500">Channels</h2>
          <div className="space-y-1">
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => openChannel(c.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active === c.id ? 'bg-agrigreen-600 text-white' : 'hover:bg-gray-50'
                }`}
              >
                <div>{c.name}</div>
                <div className={`text-xs ${active === c.id ? 'text-agrigreen-100' : 'text-gray-400'}`}>{c.type}</div>
              </button>
            ))}
            {channels.length === 0 && <p className="text-xs text-gray-400">No channels yet.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 md:col-span-2">
          {active ? (
            <>
              <div className="mb-3 max-h-96 space-y-2 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                    <div className="text-xs font-medium text-agrigreen-700">
                      {m.sender?.firstName} {m.sender?.lastName}
                    </div>
                    <div>{m.body}</div>
                  </div>
                ))}
                {messages.length === 0 && <p className="text-xs text-gray-400">No messages yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message..."
                />
                <button onClick={send} className="rounded bg-agrigreen-600 px-4 py-2 text-sm text-white">
                  Send
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select a channel to view messages.</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { buildUrl, getErrorMessage, parseResponseBody } from '../lib/api';
import { toast } from 'sonner';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const response = await fetch(buildUrl('/help/chat/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Failed to get response'));
      }
      const payload = data as { answer?: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: payload.answer || 'No response.' }]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `${msg} Please use the Contact Us button below to reach a human.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingContact(true);
    try {
      const response = await fetch(buildUrl('/contact/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      });
      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Unable to send message'));
      }
      toast.success('Message sent. We will get back to you soon.');
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setShowContactForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send message');
    } finally {
      setSendingContact(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        aria-label={open ? 'Close help chat' : 'Open help chat'}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)] flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-border bg-gradient-to-r from-indigo-500/10 to-cyan-500/10">
            <h3 className="font-semibold">
              {showContactForm ? 'Contact Us' : 'JobCrafts AI Help'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {showContactForm
                ? 'Send a message and we\'ll get back to you soon.'
                : 'Ask questions about JobCrafts AI. Need human support? Use Contact Us below.'}
            </p>
          </div>

          {showContactForm ? (
            <div className="flex-1 overflow-y-auto p-4">
              <form onSubmit={handleContactSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="chat-contact-name">Name</Label>
                  <Input
                    id="chat-contact-name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    placeholder="Your name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="chat-contact-email">Email</Label>
                  <Input
                    id="chat-contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="chat-contact-message">Message</Label>
                  <Textarea
                    id="chat-contact-message"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder="How can we help?"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowContactForm(false)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button type="submit" disabled={sendingContact} className="flex-1">
                    {sendingContact ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[320px]">
                {messages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    <p>Ask me anything about JobCrafts AI:</p>
                    <p className="mt-2 text-xs">• Pricing & plans</p>
                    <p className="text-xs">• How to use features</p>
                    <p className="text-xs">• Resume optimization</p>
                    <p className="text-xs">• And more...</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-500/20 text-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg px-3 py-2 bg-muted flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-border space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask a question..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowContactForm(true)}
                >
                  <Mail className="w-4 h-4" />
                  Contact Us (Human Support)
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

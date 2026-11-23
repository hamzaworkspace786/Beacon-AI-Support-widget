import { Send } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { readableTextColor } from "@/lib/color";

/**
 * A small picture of the chat window, drawn from the bot's settings. It is the
 * live preview on the settings page and previews what visitors will see.
 */
export function BotPreview({
  name,
  greeting,
  color,
}: {
  name: string;
  greeting: string;
  color: string;
}) {
  const text = readableTextColor(color);
  const displayName = name.trim() || "Your bot";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: color, color: text }}>
        <BotAvatar color={color} foreground={text} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
          <p className="text-xs leading-tight">Answers from our documents</p>
        </div>
      </div>

      <div className="space-y-3 bg-canvas p-4">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          {greeting.trim() || "Hi! How can I help you today?"}
        </div>
        <div
          className="ml-auto max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed"
          style={{ background: color, color: text }}
        >
          How long does delivery take?
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          Standard delivery takes 2 to 3 working days.
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <span className="flex-1 text-sm text-muted">Ask a question</span>
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ background: color, color: text }}
        >
          <Send size={15} aria-hidden="true" />
        </span>
      </div>
      <p className="pb-2.5 text-center text-[11px] text-muted">Powered by Beacon</p>
    </div>
  );
}

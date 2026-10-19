import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { CalendarIcon, MessageCircleIcon, PlayCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { env } from "../../api";

// In-app help center (feedback T16). Static articles ship in the app; the call
// booking and video guides light up when their URLs are configured, and live
// chat is offered when a provider id is set (see ChatWidget).
const ARTICLES: { q: string; a: ReactNode }[] = [
  {
    q: "How do I install the Tacto pixel?",
    a: (
      <>
        Open <strong>Sites → Install</strong>, copy the snippet and follow the steps for your
        platform (HTML, Google Tag Manager, Shopify, WordPress or Webflow). Then press{" "}
        <strong>Verify installation</strong>.
      </>
    ),
  },
  {
    q: "My notification isn't showing — what should I check?",
    a: (
      <>
        Add <code>?tacto_debug=1</code> to your page URL and open the browser console — the pixel
        explains why a notification did or didn&apos;t appear. Confirm the notification is active,
        its targeting matches the page, and that matching events exist. You can also use{" "}
        <strong>Send test event</strong> on the overview to preview one instantly.
      </>
    ),
  },
  {
    q: "How do I connect Stripe, Shopify or WooCommerce?",
    a: (
      <>
        Go to <strong>Integrations</strong>, pick the provider and paste your API key — Tacto
        registers the webhook for you and the <strong>Verify connection</strong> button confirms
        it&apos;s working.
      </>
    ),
  },
  {
    q: "How do I show customer reviews?",
    a: (
      <>
        Create a <strong>Review</strong> notification and add reviews manually, import a CSV, or
        (once credentials are configured) pull them from Google/Facebook.
      </>
    ),
  },
  {
    q: "How is my visitor quota counted?",
    a: <>Unique visitors per calendar month across your sites. See usage on the Billing page.</>,
  },
];

export function SupportDialog({ children }: { children: ReactNode }) {
  const callUrl = env.VITE_SUPPORT_CALL_URL;
  const videoUrl = env.VITE_SUPPORT_VIDEO_URL;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Help &amp; support</DialogTitle>
          <DialogDescription>Answers to common questions, or reach a human.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {callUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={callUrl} target="_blank" rel="noopener noreferrer">
                <CalendarIcon className="size-4" /> Book a 15-min setup call
              </a>
            </Button>
          ) : null}
          {videoUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                <PlayCircleIcon className="size-4" /> Watch video guides
              </a>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href="mailto:support@tacto.software">
              <MessageCircleIcon className="size-4" /> Email support
            </a>
          </Button>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {ARTICLES.map((article, index) => (
            <AccordionItem key={article.q} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-sm">{article.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                {article.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}

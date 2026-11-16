import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & How-To — CryptoPOP Wallet" },
      { name: "description", content: "How the CryptoPOP wallet works: setup, paying stores, POP rewards, Give, tap-to-pay cards, and answers for store owners." },
      { property: "og:title", content: "Help & How-To — CryptoPOP Wallet" },
      { property: "og:description", content: "Plain-English guides for shoppers, store owners and the CryptoPOP support team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

type Topic = { q: string; a: React.ReactNode };

const shoppers: Topic[] = [
  { q: "What is the CryptoPOP wallet?", a: <>A wallet on your phone for paying NectarPay stores with <b>TSD</b> (Texas Stable Dollar, worth $1 each). Every purchase earns <b>POP</b>, our rewards points. A small amount of <b>TXC</b> covers network fees.</> },
  { q: "Setting up your wallet", a: <ol className="list-decimal space-y-1 pl-5"><li>Open the app and choose to create a new wallet.</li><li>Write down your 12-word backup phrase on paper, in order.</li><li>Set your passcode.</li></ol> },
  { q: "Why the 12-word backup phrase matters", a: <>Your money lives only in your wallet, not with us. The 12 words are the only way to get it back on a new phone. Keep them offline and never share them. Nobody from CryptoPOP will ever ask for them.</> },
  { q: "Why the wallet locks itself", a: <>For safety it locks after 10 minutes of no use, after 2 minutes in the background, and whenever you reload the page. Unlock with your passcode.</> },
  { q: "Unlock and pay with Face ID or fingerprint", a: <>In <b>Settings</b>, type your passcode and tap <b>Turn on</b> next to Face ID / fingerprint, then follow your phone's prompt. After that you can unlock with your face or finger, and each payment asks for a quick face or fingerprint check before anything is sent. Your passcode always still works. Works on iPhone with iOS 18 or newer and on Android with Chrome. Changing your passcode switches it off, so turn it on again afterwards.</> },
  { q: "Paying at a store", a: <ol className="list-decimal space-y-1 pl-5"><li>Tap Scan and point at the store's NectarPay code (register screen or counter sticker).</li><li>Check the store name. For a sticker, type the amount.</li><li>Confirm. The payment is signed on your phone and sent.</li><li>Wait a moment for the POP fireworks.</li></ol> },
  { q: "Earning POP", a: <>You earn 1 POP for every $1 spent at a NectarPay store, rounded up ($2.50 = 3 POP). Rewards come in a few seconds after the store confirms the sale. Sales at brand-new stores can be held for about two weeks, then paid automatically. You'll find it all under Point history.</> },
  { q: "Give: support a church or cause while you shop", a: <>On the POP page, open <b>Give</b> and pick a cause. At stores that are in Give, 10% of your purchase goes to good causes without costing you more: on a $100 sale, $90 goes to the store, $8 to your cause, and $2 to the Give program. It's all in one payment. Look for the green <b>Give store</b> check when you scan. If you haven't picked a cause, the store gets the full amount.</> },
  { q: "Tap-to-pay cards", a: <>Link an NFC card from the Tap to Pay list on your wallet home. Each card has its own small balance ("pocket") that you top up from your wallet. Limits are $100 per tap and $500 per day. You get a Telegram approval request for anything above that. A lost card can be switched off, and its money moved back to your main balance.</> },
  { q: "Sending to a person", a: <>Use Send to transfer TSD to another wallet. Always double-check the address, because payments can't be reversed.</> },
  { q: "New phone or lost phone", a: <>Install the app and choose to restore a wallet, then type your 12 words. Your balance and card settings come back.</> },
];

const merchants: Topic[] = [
  { q: "How do I get paid?", a: <>Shoppers pay your NectarPay register code or counter sticker straight from their wallet, and TSD arrives in your store wallet. NectarPay marks the sale paid.</> },
  { q: "Register code vs. sticker", a: <>The <b>register code</b> carries the exact amount of one sale. The <b>sticker</b> is permanent: the shopper scans it and types the amount. Both show your store name in the shopper's wallet before they pay.</> },
  { q: "What is Give, and what does it cost me?", a: <>Give stores offer a 10% discount that goes to causes: 8% to the shopper's chosen church or nonprofit and 2% to the Give program. You receive 90%, and NectarPay counts the sale as paid in full. It only happens when the shopper has picked a cause. Otherwise you get 100%.</> },
  { q: "Do my customers' rewards cost me anything?", a: <>No. POP rewards are paid by CryptoPOP after NectarPay confirms the sale. They never slow down the checkout.</> },
  { q: "Card taps at my register", a: <>Customers with a CryptoPOP card can tap to pay at NectarPay terminals that support it. The money comes from the card's own pocket balance.</> },
];

const team: Topic[] = [
  { q: "How a store payment flows", a: <ol className="list-decimal space-y-1 pl-5"><li>The wallet scans the code and asks NectarPay (with a signed request) who the store is, which wallet to pay, and whether it's in Give.</li><li>If Give applies, the wallet fetches NectarPay's signed list of approved causes right then. Cause wallets are never saved in the app.</li><li>The phone builds one transaction, checks every output, and signs it on the device.</li><li>The wallet reports the payment to NectarPay, then asks for the POP reward.</li></ol> },
  { q: "\"No POP after a purchase\"", a: <>Check Point history first. Common reasons: the store is new (held about two weeks), NectarPay hasn't confirmed the sale yet, or the daily cap of 1,000 POP was reached. An hourly re-check retries queued rewards automatically, so the shopper doesn't need to pay again.</> },
  { q: "\"The Give split didn't happen\"", a: <>The split needs all four: the store is in Give, the shopper picked a cause, that cause is on NectarPay's approved list right now, and the sale is large enough for every share. Plain register codes without NectarPay details can't show Give status. If NectarPay can't be reached, the store is paid in full and nothing goes to the wrong address.</> },
  { q: "\"My wallet shows locked / no address\"", a: <>This is normal after a reload or idle time. Unlock with the passcode. If the passcode is forgotten, restore with the 12 words.</> },
  { q: "\"A card tap was refused\"", a: <>Check that the card is switched on, its pocket has enough TSD, and the tap is within $100 per tap and $500 per day. Larger taps wait for the owner's Telegram approval.</> },
  { q: "What we never do", a: <>We never ask for a 12-word phrase, never hold a shopper's main wallet keys, and never move money on someone's behalf. Card pockets are the only exception, and their money can always be moved back.</> },
];

function TopicList({ items }: { items: Topic[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((t, i) => (
        <AccordionItem key={i} value={`t${i}`} className="border-border/60">
          <AccordionTrigger className="text-left font-sans text-[15px] font-semibold normal-case tracking-normal">{t.q}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{t.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Wallet
          </Link>
          <img src={logo} alt="CryptoPOP" className="h-7 w-auto" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Help center</p>
        <h1 className="mt-2 font-display text-5xl tracking-wide">How CryptoPOP works</h1>
        <p className="mt-2 text-sm text-muted-foreground">Short guides for paying stores, earning POP, giving, and tap-to-pay cards.</p>
        <Tabs defaultValue="shoppers" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="shoppers">Shoppers</TabsTrigger>
            <TabsTrigger value="stores">Stores</TabsTrigger>
            <TabsTrigger value="team">Support</TabsTrigger>
          </TabsList>
          <TabsContent value="shoppers"><TopicList items={shoppers} /></TabsContent>
          <TabsContent value="stores"><TopicList items={merchants} /></TabsContent>
          <TabsContent value="team"><TopicList items={team} /></TabsContent>
        </Tabs>
        <div className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/manifesto" className="hover:text-foreground">Manifesto</Link>
          <a href="https://honest.money" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Part of the honest.money ecosystem</a>
        </div>
      </main>
    </div>
  );
}

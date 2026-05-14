import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/api")({
  head: () => ({
    meta: [
      { title: "TXC L2 / Omni Layer Developer Guide — CryptoPOP" },
      {
        name: "description",
        content:
          "How to mint, send, and read POP tokens on the Texitcoin (TXC) L2 Omni Layer. Field-tested specs, RPC calls, and gotchas for token issuers and wallet builders.",
      },
      { property: "og:title", content: "TXC L2 / Omni Layer Developer Guide — CryptoPOP" },
      {
        property: "og:description",
        content:
          "Field-tested specs, RPC calls, and gotchas for issuing tokens on the Texitcoin (TXC) Omni Layer.",
      },
    ],
  }),
  component: L2ApiPage,
});

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
      {children}
    </code>
  );
}

function Block({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
      <code data-lang={lang}>{children}</code>
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-12 scroll-mt-24 font-display text-2xl font-bold tracking-tight md:text-3xl"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-8 font-display text-lg font-semibold md:text-xl">{children}</h3>
  );
}

function L2ApiPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <a href="#quickstart" className="hover:text-foreground transition">Quickstart</a>
            <a href="#mint" className="hover:text-foreground transition">Mint</a>
            <a href="#gotchas" className="hover:text-foreground transition">Gotchas</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Title */}
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Developer Guide · v1
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
          TXC L2 / Omni Layer
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A field guide to issuing, minting, and moving Omni-Layer tokens on the
          Texitcoin (TXC) chain. Everything below is what we actually had to do
          to ship POP — the docs that exist elsewhere are sparse and a few of
          the defaults from upstream Omni do not apply here.
        </p>

        {/* TOC */}
        <nav aria-label="Contents" className="mt-10 rounded-lg border border-border/60 bg-card p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Contents</p>
          <ol className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            <li><a className="hover:underline" href="#network">1. Network parameters</a></li>
            <li><a className="hover:underline" href="#quickstart">2. Quickstart</a></li>
            <li><a className="hover:underline" href="#rpc">3. RPC reference</a></li>
            <li><a className="hover:underline" href="#mint">4. Minting (Grant)</a></li>
            <li><a className="hover:underline" href="#send">5. Sending tokens</a></li>
            <li><a className="hover:underline" href="#read">6. Reading balances</a></li>
            <li><a className="hover:underline" href="#opreturn">7. OP_RETURN format</a></li>
            <li><a className="hover:underline" href="#gotchas">8. Gotchas (read this)</a></li>
          </ol>
        </nav>

        <H2 id="network">1. Network parameters</H2>
        <p className="mt-3 text-muted-foreground">
          TXC is a Bitcoin-derived chain. The Omni Layer protocol runs on top of
          it the same way it runs on Bitcoin — by encoding token operations into
          OP_RETURN outputs of regular TXC transactions.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/60">
              <tr><td className="px-4 py-2 font-mono text-xs">P2PKH version byte</td><td className="px-4 py-2 font-mono text-xs">0x42</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">Address prefix (decoded)</td><td className="px-4 py-2 font-mono text-xs">starts with <Code>T</Code></td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">Message-sign prefix</td><td className="px-4 py-2 font-mono text-xs">"Texitcoin Signed Message:\n"</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">Mempool / Esplora API</td><td className="px-4 py-2 font-mono text-xs">https://mempool.texitcoin.org/api</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">Dust threshold (effective)</td><td className="px-4 py-2 font-mono text-xs">10,000 sats</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">Suggested fee rate</td><td className="px-4 py-2 font-mono text-xs">5 sat/vB</td></tr>
              <tr><td className="px-4 py-2 font-mono text-xs">Omni magic bytes</td><td className="px-4 py-2 font-mono text-xs">"omni" (4 ASCII bytes)</td></tr>
            </tbody>
          </table>
        </div>

        <H2 id="quickstart">2. Quickstart</H2>
        <p className="mt-3 text-muted-foreground">You need three things:</p>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>
            A funded TXC address with the <strong>issuer's private key</strong>{" "}
            (the address that originally created the token via{" "}
            <Code>omni_sendissuancemanaged</Code>).
          </li>
          <li>
            Access to a TXC full node with the Omni Layer module enabled,
            reachable over JSON-RPC (auth: HTTP Basic).
          </li>
          <li>The <strong>property ID</strong> of your token (e.g. POP is <Code>21</Code>).</li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          Then the loop is: <strong>build payload → assemble tx → sign → broadcast</strong>.
          The node only helps with step 1 — you assemble, sign, and broadcast yourself
          (the wallet RPCs assume the issuer key lives in the node's wallet, which is
          not how most app integrations work).
        </p>

        <H2 id="rpc">3. RPC reference</H2>
        <p className="mt-3 text-muted-foreground">
          Standard Bitcoin-style JSON-RPC. <Code>Content-Type: text/plain</Code>,
          HTTP Basic auth, body is <Code>{`{ jsonrpc, id, method, params }`}</Code>.
        </p>
        <Block lang="bash">{`curl -u user:pass -H 'content-type: text/plain' \\
  -d '{"jsonrpc":"1.0","id":"x","method":"omni_getproperty","params":[21]}' \\
  https://your-txc-node.example/`}</Block>
        <p className="mt-3 text-muted-foreground">Methods we use day-to-day:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
          <li><Code>omni_getproperty &lt;id&gt;</Code> — token metadata + issuer address</li>
          <li><Code>omni_getbalance &lt;addr&gt; &lt;id&gt;</Code> — balance of one address</li>
          <li><Code>omni_createpayload_grant &lt;id&gt; &lt;amount&gt; &lt;grantdata&gt;</Code> — payload for a managed-token mint</li>
          <li><Code>omni_createpayload_simplesend &lt;id&gt; &lt;amount&gt;</Code> — payload for a transfer</li>
          <li><Code>omni_decodetransaction &lt;rawhex&gt;</Code> — sanity-check a tx before broadcast</li>
          <li><Code>omni_gettransaction &lt;txid&gt;</Code> — read back the parsed Omni tx after confirmation</li>
        </ul>

        <H2 id="mint">4. Minting (Grant)</H2>
        <p className="mt-3 text-muted-foreground">
          For <strong>managed</strong> tokens, the issuer mints new units via a
          Grant operation. The flow:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>Ask the node for the Omni payload bytes.</li>
          <li>Pull UTXOs for the issuer address from the Esplora API.</li>
          <li>
            Build a tx with <strong>three outputs</strong> in this exact order:
            <Code>OP_RETURN(payload)</Code>, dust to the receiver, change back to issuer.
          </li>
          <li>Sign every input with the issuer key.</li>
          <li>POST the raw hex to the Esplora <Code>/tx</Code> endpoint.</li>
        </ol>

        <H3>Build the payload</H3>
        <Block lang="ts">{`const payloadHex: string = await rpc("omni_createpayload_grant", [
  21,             // property id
  "100.00000000", // amount as a decimal string (8 dp for divisible)
  "",             // grantdata — REQUIRED, even when empty (see Gotchas)
]);`}</Block>

        <H3>Assemble & broadcast</H3>
        <Block lang="ts">{`import * as bitcoin from "bitcoinjs-lib";

const opReturnData = Buffer.concat([
  Buffer.from("omni", "ascii"),     // magic
  Buffer.from(payloadHex, "hex"),   // payload from RPC — DO NOT prepend extra bytes
]);
const opReturn = bitcoin.payments.embed({ data: [opReturnData] }).output!;

const psbt = new bitcoin.Psbt({ network: TXC });
// ... addInput() for each issuer UTXO with nonWitnessUtxo ...

psbt.addOutput({ script: opReturn, value: 0n });
psbt.addOutput({ address: receiver, value: 10_000n }); // dust = 10k sats on TXC
psbt.addOutput({ address: issuer,   value: changeSats });

psbt.signAllInputs(signer);
psbt.finalizeAllInputs();

const rawHex = psbt.extractTransaction().toHex();
const txid = await fetch("https://mempool.texitcoin.org/api/tx", {
  method: "POST", headers: { "content-type": "text/plain" }, body: rawHex,
}).then(r => r.text());`}</Block>

        <H2 id="send">5. Sending tokens</H2>
        <p className="mt-3 text-muted-foreground">
          A wallet-to-wallet transfer is exactly the same shape as a mint —
          just swap the payload method to <Code>omni_createpayload_simplesend</Code>.
          The signing key becomes the <em>sender's</em> key (not the issuer), and
          the dust output goes to the recipient.
        </p>
        <Block lang="ts">{`const payloadHex = await rpc("omni_createpayload_simplesend", [
  21,
  "5.00000000",
]);
// ...same OP_RETURN + dust + change construction as the Grant flow...`}</Block>

        <H2 id="read">6. Reading balances</H2>
        <Block lang="ts">{`type Bal = { balance: string; reserved: string; frozen: string };
const bal: Bal = await rpc("omni_getbalance", [address, 21]);
// bal.balance is a decimal string like "100.00000000"`}</Block>
        <p className="mt-3 text-muted-foreground">
          Note: the balance only updates after the funding tx confirms. Until
          then it appears as <Code>0</Code>. If you need optimistic UI, mirror
          the expected balance in your own DB and reconcile periodically against{" "}
          <Code>omni_getbalance</Code>.
        </p>

        <H2 id="opreturn">7. OP_RETURN format (Class C)</H2>
        <p className="mt-3 text-muted-foreground">
          Omni Class C transactions encode the entire operation in the OP_RETURN
          payload. The byte layout is:
        </p>
        <Block>{`+------+----------------------------------------------+
| omni |  <payload from omni_createpayload_*>          |
+------+----------------------------------------------+
  4 B          variable (already includes version+type)`}</Block>
        <p className="mt-3 text-muted-foreground">
          That's it. The payload returned by the <Code>omni_createpayload_*</Code>{" "}
          family already contains the version bytes and the operation type byte —
          so you only need to prepend the 4-byte <Code>"omni"</Code> magic. Do
          not add any other framing bytes (see the next section).
        </p>

        <H2 id="gotchas">8. Gotchas (the stuff that cost us a day)</H2>

        <H3>Don't prepend extra zero bytes to the payload</H3>
        <p className="mt-3 text-muted-foreground">
          A common pattern in older Omni examples is{" "}
          <Code>"omni" + 0x00 0x00 + payload</Code>. On TXC that causes the node
          to interpret your Grant as a <em>Simple Send</em> for some random
          property ID (the version+type bytes get shifted). Symptom:{" "}
          <Code>omni_decodetransaction</Code> shows the wrong type, the receiver
          balance never moves, and there's no error in the broadcast.
        </p>
        <p className="mt-2 text-muted-foreground">
          Concatenate just <Code>"omni" + payload</Code>. Nothing else.
        </p>

        <H3>The <Code>grantdata</Code> argument is not optional (and it's a memo)</H3>
        <p className="mt-3 text-muted-foreground">
          Upstream Omni docs say the third argument to{" "}
          <Code>omni_createpayload_grant</Code> is optional. On the TXC node
          it's required — the 2-arg form returns the help text instead of a
          payload. It's also more useful than it looks: <Code>grantdata</Code>{" "}
          is a free-form attribution memo embedded <em>inside</em> the Omni
          payload itself, so it travels with the grant on-chain and shows up
          in <Code>omni_gettransaction</Code> output. Cap it at ~60 bytes —
          the entire OP_RETURN (magic + payload + memo) has to fit under the
          node's datacarrier size limit (80 bytes by default).
        </p>
        <Block lang="ts">{`rpc("omni_createpayload_grant", [propertyId, amount, ""]);                 // no memo
rpc("omni_createpayload_grant", [propertyId, amount, "claim:abc123"]);     // attribution memo`}</Block>

        <H3>Chain your own change for back-to-back mints</H3>
        <p className="mt-3 text-muted-foreground">
          TXC blocks take real time to land. If you mint twice in quick
          succession, the second mint's only spendable coin is the{" "}
          <strong>unconfirmed change output</strong> from the first. The
          symptom is confusing: the second mint fails with{" "}
          <Code>"issuer has no UTXOs"</Code> even though a block explorer
          clearly shows the address is funded.
        </p>
        <p className="mt-2 text-muted-foreground">
          The fix is to <strong>not</strong> filter out unconfirmed UTXOs
          when reading from Esplora's <Code>/address/:addr/utxo</Code>{" "}
          endpoint. Sort confirmed-first so settled coins are preferred, and
          fall through to your own unconfirmed change only when needed:
        </p>
        <Block lang="ts">{`const utxos = raw
  .sort((a, b) => Number(b.status.confirmed) - Number(a.status.confirmed))
  .map(({ txid, vout, value }) => ({ txid, vout, value }));`}</Block>
        <p className="mt-2 text-muted-foreground">
          Caveat: spending unconfirmed change builds a tx chain. If the
          parent gets evicted or RBF'd, every child mint becomes invalid
          along with it. For high-throughput minting, either batch grants
          into a single tx or pre-fund several issuer UTXOs so each mint
          can spend a settled coin.
        </p>

        <H3>Dust threshold is 10,000 sats, not 546</H3>
        <p className="mt-3 text-muted-foreground">
          The Bitcoin default is 546 sats. TXC's mempool policy is stricter and
          rejects anything under <strong>10,000 sats</strong> as dust. If your
          reference output (the dust output to the recipient) is below that, the
          broadcast fails with a generic mempool error. Use 10,000 and budget
          for it in your fee math.
        </p>

        <H3>Amount formatting</H3>
        <p className="mt-3 text-muted-foreground">
          For divisible tokens, pass the amount as a decimal string with up to
          8 decimal places: <Code>"100"</Code> and <Code>"100.00000000"</Code>{" "}
          both work. For indivisible tokens use a plain integer string. Don't
          pass numbers — the JSON-RPC layer will round large values.
        </p>

        <H3>Wallet RPCs aren't useful for app integrations</H3>
        <p className="mt-3 text-muted-foreground">
          <Code>omni_send</Code> and friends require the signing key to be in the
          node's wallet. For a hosted app where keys live in your backend (or in
          the user's own wallet), use the <Code>omni_createpayload_*</Code>{" "}
          family and assemble the tx yourself, exactly like the snippet above.
        </p>

        <H3>Confirmations</H3>
        <p className="mt-3 text-muted-foreground">
          Broadcasted Omni txs show up immediately in the mempool but Omni only
          parses them after confirmation. Don't rely on{" "}
          <Code>omni_gettransaction</Code> to return data for a 0-conf tx —
          poll until the block lands, or watch the address via Esplora's
          websocket / address endpoints.
        </p>

        {/* Footer */}
        <hr className="my-12 border-border/60" />
        <p className="text-sm text-muted-foreground">
          Built and battle-tested while shipping POP.{" "}
          <Link to="/" className="underline hover:text-foreground">Back to CryptoPOP</Link>.
        </p>
      </main>
    </div>
  );
}

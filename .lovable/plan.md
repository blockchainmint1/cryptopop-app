# NectarPay payment progress handoff

## What we’ll fix
- Keep NectarPay’s new instant scan-time update: its signed QR lookup now displays “CryptoPOP is paying” immediately.
- Make CryptoPOP’s post-broadcast `payment_submitted` notice start directly in the payment response, waiting no more than 1.5 seconds, while preserving background completion and never rebroadcasting a payment.
- Keep sticker and card-payment notices on the same verified contract.

## Safety checks
- A slow, failed, or rejected progress notice can never turn a successfully broadcast payment into a failure.
- The transaction ID, signed invoice, and merchant output must still match before a notice is sent.
- Add regression tests for direct startup, the 1.5-second cap, and notice failures; run the wallet safety suite.

## Verification and handoff
- Check NectarPay’s latest published receiver against our request/signing format.
- Run a no-funds signed test where possible; leave any real purchase for Bobby’s explicit test.
- Update the roadmap and provide an auditor handoff with the exact commit and remaining live-test step.

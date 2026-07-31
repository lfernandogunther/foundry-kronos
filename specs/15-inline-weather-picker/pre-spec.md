# 15 — The inline weather picker (pre-spec)

Not a spec yet.

## What

The reference's dropdown on the weather block: eight conditions as icon rows, plus a full-width row to
go back to generated weather. Click the weather, pick a condition, done.

We open a dialog instead. Round 04 chose that deliberately: the dialog also edits the coldest and warmest
temperatures for the day, which the reference's picker has no room for, and dropping those would have
been a regression.

## To decide before the spec

1. **Where the two temperatures go.** Options: leave them in the dialog and reach it from a row in the
   picker; put two small inputs in the picker's footer; or drop hand-set temperatures and keep the
   generated ones when only a condition is overridden.
2. **Whether the picker replaces the dialog or precedes it.** Two ways to do the same thing is a cost.

## Why it should wait

The dialog's styling has never been seen in a running Foundry — it hangs off Foundry's own frame element
names, which could not be confirmed from public documentation. Building the picker before knowing whether
the dialog looks right means building the second thing on the same surface while the first is unverified.

One screenshot from anyone with a licence unblocks this.

## Size and dependencies

Small. Blocked on nothing technically; blocked in practice on seeing the dialog once.

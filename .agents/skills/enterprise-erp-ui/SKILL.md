---
name: enterprise-erp-ui
description: >-
  Enforces elite, production-grade UI/UX design standards for Enterprise ERP, MRP, B2B dashboards,
  and data-dense operational web applications. Eliminates AI-generated clichés (neon glows, excessive
  empty padding, cookie-cutter stat cards) in favor of high-density information architecture,
  functional color palettes, operational batch controls, slide-over inspector drawers, keyboard
  navigation, and tabular typography inspired by Stripe, Linear, Palantir, and modern SAP Fiori.
---

# Enterprise ERP UI/UX Design System (Anti-AI Slop Standard)

Use this skill whenever designing, scaffolding, or refining dashboards, ERP systems, MRP software, administrative portals, or B2B web applications.

---

## 1. The Anti-AI Cliché Manifest (Strict Prohibitions)

Standard AI generation tends to produce generic, unusable "crypto/fintech" templates. When creating ERP dashboards, **strictly avoid**:

*   ❌ **NO Neon Glows & Fluorescent Shadows**: Never use `box-shadow: 0 0 20px cyan` or saturated purple-to-pink gradient borders.
*   ❌ **NO The "Cliché 4-Card" Syndrome**: Do not slap 4 identical floating boxes with a generic rounded icon, a 32px bold number, and a fake green `+12.4%` pill unless they are tightly integrated operational micro-KPIs.
*   ❌ **NO Wasted White Space**: Generous 40px paddings look pretty on Dribbble, but ruin ERPs where plant managers and accountants need to see 20+ rows without endless scrolling.
*   ❌ **NO Meaningless Wavy Spline Charts**: Giant decorative Bézier curve charts without axes, units, or filter ranges add zero business value. Replace with dense operational data grids and compact sparklines.
*   ❌ **NO Dead Ends**: Every status badge, table row, and metric card must have an operational purpose (e.g., clickable filter, drawer expansion, quick edit).

---

## 2. The 6 Pillars of Modern Enterprise ERP Design

```
+----------------------------------------------------------------------------------------------------+
| Top Bar: [Branch Switcher] [Global Cmd+K Search]                    [Live Sync Dot] [User Avatar]  |
+-------------------+--------------------------------------------------------------+-----------------+
| SIDEBAR           | MAIN WORKSPACE (Compact & Action-Oriented)                   | INSPECTOR PANEL |
| - Dashboard       | +----------------------------------------------------------+ | (Slide-over)    |
| - Production (MRP)| | Compact KPIs: OEE 89.4% | Turnover 6.2x | Work Orders 42 | | - SKU Overview  |
| - Inventory       | +----------------------------------------------------------+ | - BOM Breakdown |
| - Procurement     | Filter Toolbar: [Status: All v] [Warehouse: Plant 1 v] [Export] | - Audit Trail   |
| - BOM             | +----------------------------------------------------------+ | - Supplier ETA  |
| - Ledger          | | Operational Data Table (Sticky Header, Monospace SKUs)   | |                 |
|                   | | [x] ORD-9021 | Rotor Stator | [In Assembly] | $1,420.00  | |                 |
|                   | | [ ] ORD-9022 | Bearing Hub  | [Quality Hold]| $3,890.50  | |                 |
+-------------------+--------------------------------------------------------------+-----------------+
```

### Pillar 1: High Information Density & Grid Hierarchy
*   **Row Heights**: Data tables must use compact heights (36px to 42px per row).
*   **Padding**: Cards and table cells use compact padding: `p-3` (12px) or `p-4` (16px), never `p-8` (32px).
*   **Sticky Elements**: Table headers (`sticky top-0`) and action bars must remain accessible during long data reviews.
*   **Visual Grid**: Clear, crisp 1px borders using neutral slate (`border-slate-800` or `border-zinc-200`) instead of heavy card drop shadows.

### Pillar 2: Functional Semantic Color Architecture (90/10 Rule)
90% of the interface must be neutral (slate, zinc, deep navy, neutral white). The remaining 10% is **purely functional**:

*   **Canvas & Surface**: Dark theme (`#090d16` base, `#111827` cards) or clean Light theme (`#f8fafc` base, `#ffffff` cards).
*   **Emerald / Green (`#10b981`)**: Strictly for "Completed", "In Spec", "In Stock", "Active Running".
*   **Amber / Yellow (`#f59e0b`)**: Strictly for "Reorder Threshold Reached", "Awaiting Inspection", "Delayed".
*   **Rose / Crimson (`#f43f5e`)**: Strictly for "Stockout", "Critical Scrap", "Rejected", "Over-budget".
*   **Cobalt / Blue (`#3b82f6`)**: Primary operational interactions, active selection, link navigation.

### Pillar 3: Tabular Numbers & Typography
*   **Numbers & Financials**: Always apply `font-mono` or `font-variant-numeric: tabular-nums` to financial balances, SKU codes, and quantities so columns align perfectly.
*   **Status Badges (Chips)**: Use subtle tinted backgrounds with a solid 1px border ring:
    ```html
    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> En Proceso
    </span>
    ```

### Pillar 4: Master-Detail Inspector Drawer (Slide-over)
Do not navigate to a new page for simple record inspection. When an operator clicks a table row:
*   Slide out a 380px - 440px right-hand panel (`drawer` / `slide-over`).
*   Show: Bill of Materials (BOM) components, unit costs, supplier lead times, and audit logs.
*   Provide immediate inline action buttons: `[Liberar Lote]`, `[Rechazar]`, `[Imprimir Etiqueta]`.

### Pillar 5: Batch Operations & Keyboard Control
*   **Batch Action Bar**: When 1 or more row checkboxes are selected, pop up a floating bottom or top action bar:
    *   `5 órdenes seleccionadas | [Cambiar Estado v] [Exportar a Excel] [Asignar Operador]`
*   **Keyboard Command Palette**: Provide a visible shortcut trigger for `Cmd + K` / `Ctrl + K` allowing instant multi-entity search (Orders, SKUs, Suppliers, Machine IDs).

### Pillar 6: Micro-Sparklines & Operational KPIs
Replace useless oversized spline charts with:
*   Compact trend sparklines (width 60px-80px, height 24px) inside metric cards.
*   Horizontal segmented progress bars for machine OEE or capacity utilization (e.g. 78% Operational, 14% Idle, 8% Maintenance).

---

## 3. Reference Component Patterns

### Modern Operational Table Template (Tailwind HTML)
```html
<div class="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
  <table class="w-full text-left text-xs text-slate-300">
    <thead class="bg-slate-950/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
      <tr>
        <th class="w-10 px-3 py-2.5"><input type="checkbox" class="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"></th>
        <th class="px-3 py-2.5 font-mono">SKU / Lote</th>
        <th class="px-3 py-2.5">Descripción del Material</th>
        <th class="px-3 py-2.5">Línea de Ensamble</th>
        <th class="px-3 py-2.5 text-right font-mono">Cantidad</th>
        <th class="px-3 py-2.5 text-center">Estado</th>
        <th class="px-3 py-2.5 text-right">Acciones</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-800/60 font-sans">
      <tr class="hover:bg-slate-800/40 cursor-pointer transition-colors group">
        <td class="px-3 py-2"><input type="checkbox" class="rounded border-slate-700 bg-slate-800"></td>
        <td class="px-3 py-2 font-mono font-medium text-slate-200">MK-4091</td>
        <td class="px-3 py-2 text-slate-200">Bobina Inductora de Cobre 24V</td>
        <td class="px-3 py-2 text-slate-400">Línea 2 (Planta Norte)</td>
        <td class="px-3 py-2 text-right font-mono text-slate-100 font-medium">1,250 pzas</td>
        <td class="px-3 py-2 text-center">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Producción
          </span>
        </td>
        <td class="px-3 py-2 text-right">
          <button class="px-2 py-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 text-xs">Inspeccionar →</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 4. Verification Checklist Before Delivering Any Dashboard

1. [ ] **Color Check**: Is 90% of the palette neutral slate/zinc? Did you remove all neon box-shadows?
2. [ ] **Density Check**: Can the user see at least 10-15 rows of data without excessive scrolling?
3. [ ] **Action Check**: Are there batch actions, filters, or detail drawers available?
4. [ ] **Typography Check**: Are prices, quantities, and SKU codes formatted with `font-mono` / `tabular-nums`?
5. [ ] **Context Check**: Does every chart provide explicit unit labels, timeline bounds, and a clear business purpose?

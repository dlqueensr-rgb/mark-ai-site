// _pd_load.cjs — Load the 16 Precision Garage Door drip EMAIL campaigns into precision-door-demo.
// Mirrors the master structure exactly, Precision green/cream, permanent Supabase image URLs,
// only the {tokens} dripRunner._render supports. Idempotent upsert. All draft/disabled.
// Run: cd ~/mark && curl ... -o _pd_load.cjs && doppler run -- node _pd_load.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const SB = 'https://auabkpiibobnznasyebl.supabase.co/storage/v1/object/public/franchise-flyers/brand-masters/precision-door';
const GREEN='#044F3B', CREAM='#E7D3AE';
const header = id => SB+'/headers/'+id+'.png';
const mid    = id => SB+'/photos/body-'+id+'.jpg';
const LOGO_FOOTER = SB+'/logo-header.png';
const WW = { tz:'America/Los_Angeles', days:[1,2,3,4,5], end_hour:18, start_hour:9 };
const HW = { tz:'America/Los_Angeles', days:[1,2,3,4,5,6,7], end_hour:19, start_hour:9 };

function body(e){
  const offerBlock = `
        <tr><td style="padding:6px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREEN};">
            <tr><td style="padding:22px 24px 0 24px;"><div style="border-top:2px dashed #cfe0d7;font-size:0;line-height:0;">&nbsp;</div></td></tr>
            <tr><td align="center" style="padding:18px 24px 2px 24px;">{offerTiers}<div style="color:${CREAM};font-size:42px;font-weight:bold;line-height:1;">{offerAmount} OFF</div><div style="color:#e9f2ec;font-size:14px;margin-top:4px;">{offerMin}</div></td></tr>
            <tr><td align="center" style="padding:6px 24px 2px 24px;"><div style="color:#ffffff;font-size:16px;">{offerExpiry}.</div></td></tr>
            <tr><td align="center" style="padding:4px 24px 2px 24px;"><div style="color:#e9f2ec;font-size:14px;">Reserve your spot before the offer ends &mdash; work scheduled at your convenience.</div></td></tr>
            <tr><td align="center" style="padding:16px 24px 18px 24px;"><a href="tel:{campaignPhone}" style="display:inline-block;background:${CREAM};color:${GREEN};text-decoration:none;font-size:17px;font-weight:bold;padding:14px 30px;border-radius:4px;">Call {campaignPhone} to Book</a></td></tr>
            <tr><td style="padding:0 24px 16px 24px;"><div style="border-top:2px dashed #cfe0d7;font-size:0;line-height:0;">&nbsp;</div></td></tr>
            <tr><td align="center" style="padding:0 24px 20px 24px;"><div style="color:#cfe0d7;font-size:11px;line-height:1.5;">{offerTerms}</div></td></tr>
          </table>
        </td></tr>`;
  const simpleCta = `
        <tr><td style="padding:6px 28px 18px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="tel:{campaignPhone}" style="display:inline-block;background:${CREAM};color:${GREEN};text-decoration:none;font-size:17px;font-weight:bold;padding:14px 30px;border-radius:4px;">Call Us {campaignPhone}</a>
        </td></tr></table></td></tr>`;
  return `<div style="margin:0;padding:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;">
        <tr><td style="padding:0;font-size:0;line-height:0;"><img src="${header(e.id)}" alt="{companyName}" width="600" style="display:block;width:100%;max-width:600px;height:auto;"></td></tr>
        <tr><td align="center" style="background:${GREEN};padding:12px 24px;"><a href="tel:{campaignPhone}" style="display:inline-block;background:${CREAM};color:${GREEN};text-decoration:none;font-size:16px;font-weight:bold;padding:9px 22px;border-radius:4px;">Call {campaignPhone}</a></td></tr>
        <tr><td style="padding:30px 30px 6px 30px;color:#333333;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px 0;">Hi {firstName},</p>
          ${e.copy}
        </td></tr>
${e.offer ? offerBlock : simpleCta}
        <tr><td style="padding:0;font-size:0;line-height:0;"><img src="${mid(e.id)}" alt="{brand} garage door technician at work" width="600" style="display:block;width:100%;max-width:600px;height:auto;"></td></tr>
        <tr><td align="center" style="padding:22px 30px 6px 30px;color:#333333;">
          <div style="font-size:18px;font-weight:bold;color:#1a1a1a;">${e.closeTitle}</div>
          <div style="font-size:14px;line-height:1.5;color:#555555;margin-top:8px;">${e.closeSub}</div>
        </td></tr>
        <tr><td style="padding:18px 0 0 0;"><div style="height:14px;background:${CREAM};font-size:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td style="background:${GREEN};padding:22px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="left" style="vertical-align:middle;"><img src="${LOGO_FOOTER}" alt="{companyName}" width="150" style="display:block;width:150px;max-width:150px;height:auto;"></td>
            <td align="right" style="vertical-align:middle;color:#eef5f0;font-size:12px;line-height:1.6;"><div style="font-weight:bold;">{companyName}</div><div>{cityStateZip}</div><div>{contractorLicense}</div></td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:14px 26px;color:#999999;font-size:11px;line-height:1.6;">You&rsquo;re receiving this because you&rsquo;re a valued customer of {companyName}.<br><a href="mailto:unsubscribe@markainotify.com?subject=Unsubscribe" style="color:#999999;text-decoration:underline;">Unsubscribe</a></td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

const TIERED = { type:'tiered', tiers:[{label:'$200+ job',amount:'$25'},{label:'$500+ job',amount:'$50'},{label:'$1,000+ job',amount:'$100'}] };

const D = [
 { id:'01', camp:'Mark AI — Win-Back Drip (Residential)', tpl:'Win-Back Email — Residential',
   subject:"We miss you, {firstName} — let's get that garage door running right",
   copy:`<p style="margin:0 0 16px 0;">It&rsquo;s been a while since we were last at your home, and we&rsquo;d love to help with whatever your garage door needs &mdash; a noisy opener, a door that sticks or won&rsquo;t close right, a worn spring, or just a tune-up to keep it running smooth and safe.</p><p style="margin:0 0 16px 0;">Our background-checked {brand} technicians fix it fast and fix it right the first time &mdash; backed by the Neighborly Done Right Promise. Here&rsquo;s a little something to welcome you back:</p>`,
   offer:true, closeTitle:"From uh-oh to oh-wow &mdash; let&rsquo;s get it done.", closeSub:"Call to book &mdash; just mention this email to claim your savings.",
   goal:'reactivate lapsed residential customers', sw:HW,
   config:{ offer:Object.assign({},TIERED,{subhead:'Enjoy a special We Miss You discount on your next service!',headline:'Welcome Back:',expires_days:30}) },
   instructions:'Contacts residential customers who have not booked in 6+ months. Sends a win-back offer. Runs Mon-Sun, rolling 200/day. We suggest tiered: $25 off a $200+ job, $50 off $500+, $100 off $1,000+.',
   delay:0, ae:{ segment:'win_back', customer_type:'residential', months:6, project_label:'your past service', daily_limit:200, reenroll:365, notes:'Win-Back, residential, lapsed 6mo+ — GATED draft' } },

 { id:'02', camp:'Mark AI — We Miss You (Commercial)', tpl:'We Miss You Email — Commercial',
   subject:"We&rsquo;ve missed you, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">It&rsquo;s been a while since we last helped your business, and we&rsquo;d love to be your go-to garage door team again &mdash; from overhead door repairs and opener service to springs, cables, and new installations, handled with as little disruption to your operation as possible.</p><p style="margin:0 0 16px 0;">Our technicians keep {city} businesses up and running. Here&rsquo;s a little something to welcome you back:</p>`,
   offer:true, closeTitle:"Let&rsquo;s get you back on the schedule.", closeSub:"Call to book &mdash; mention this email for your savings.",
   goal:'reactivate lapsed commercial customers', sw:WW,
   config:{ offer:{ amount:'$50', subhead:"It's been a while — here's a little something to welcome you back.", headline:"We've Missed You", expires_days:30 } },
   instructions:'Contacts commercial customers who have not booked in 6+ months. Sends a win-back discount. Runs Mon-Fri 9AM-6PM, rolling 200/day. We suggest $50 off, valid 30 days.',
   delay:0, ae:{ segment:'win_back', customer_type:'commercial', months:6, project_label:'your past service', daily_limit:200, reenroll:365, notes:'We Miss You, commercial, win_back 6mo — GATED draft' } },

 { id:'03', camp:'Mark AI — Customer Welcome (Residential)', tpl:'Welcome Email — Residential',
   subject:"Welcome to the {brand} family, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Welcome to {brand}! We&rsquo;re glad you found us, and we&rsquo;re here whenever your garage door needs attention &mdash; big or small.</p><p style="margin:0 0 16px 0;">From broken springs, openers, and off-track doors to brand-new garage door installation, our background-checked technicians get it done right &mdash; and we back every job with the Neighborly Done Right Promise. Here&rsquo;s a little something to get started:</p>`,
   offer:true, closeTitle:"Whenever you need us, we&rsquo;re one call away.", closeSub:"Just mention this email when you call and we&rsquo;ll take care of the rest.",
   goal:'welcome', sw:WW,
   config:{ offer:{ type:'flat', amount:'$25', expires_days:null } },
   instructions:'Welcomes new residential customers after their first completed job. Sends a thank-you and next-visit discount. Fires once per customer. Runs Mon-Fri. We suggest $25 off next visit.',
   delay:0, ae:{ segment:'new_customer', customer_type:'residential', months:3, project_label:'your first visit', daily_limit:200, reenroll:null, notes:'Customer Welcome, residential, new_customer 3mo — GATED draft' } },

 { id:'04', camp:'Mark AI — Customer Welcome (Commercial)', tpl:'Welcome Email — Commercial',
   subject:"Welcome to the {brand} family, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Welcome to {brand}! We&rsquo;re glad to partner with your business and keep your overhead doors opening smoothly and safely.</p><p style="margin:0 0 16px 0;">From routine maintenance to opener repairs, spring replacement, and new door installation, our technicians work around your schedule to keep downtime to a minimum.</p><p style="margin:0 0 16px 0;">With the Neighborly Done Right Promise, you can trust that every job is handled with care. Thank you for choosing us to support your business.</p>`,
   offer:false, closeTitle:"We look forward to working with you.", closeSub:"Whenever something needs attention &mdash; big or small &mdash; we&rsquo;re just a call away.",
   goal:'welcome', sw:WW,
   config:{},
   instructions:'Welcomes new commercial customers after their first job. Introduces your business and provides your direct line. Fires once per customer. Runs Mon-Fri.',
   delay:0, ae:{ segment:'new_customer', customer_type:'commercial', months:3, project_label:'your first visit', daily_limit:200, reenroll:null, notes:'Customer Welcome, commercial, new_customer 3mo — GATED draft' } },

 { id:'05', camp:'Mark AI — Post-Job Thank You (Residential)', tpl:'Post-Job Thank You Email — Residential',
   subject:"Thank you for your business, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Thank you for trusting {brand} with your garage door &mdash; it was a pleasure helping you, and we hope it&rsquo;s opening smooth and quiet.</p><p style="margin:0 0 16px 0;">If anything comes up or you&rsquo;ve got another project in mind, we&rsquo;re always just a call away. Here&rsquo;s a little something off your next visit:</p>`,
   offer:true, closeTitle:"Thanks again from all of us at {brand}.", closeSub:"Mention this email when you call and we&rsquo;ll get you on the schedule.",
   goal:'thank recent customers and offer $25 off next visit', sw:WW,
   config:{ offer:{ amount:'$25', subhead:'Your next visit with us.', headline:'Thank You For Your Business', expires_days:null } },
   instructions:'Sends a thank-you and discount offer to residential customers within 14 days of a completed job. Drives repeat bookings. Runs Mon-Fri 9AM-6PM, rolling 200/day. We suggest $25 off next visit.',
   delay:0, ae:{ segment:'recent_no_rebook', customer_type:'residential', months:2, days_window:14, project_label:'your recent service', daily_limit:200, reenroll:60, notes:'Post-job thank-you, residential, recent_no_rebook 2mo' } },

 { id:'06', camp:'Mark AI — Post-Job Thank You (Commercial)', tpl:'Post-Job Thank You Email — Commercial',
   subject:"Thank you for your business, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Thank you for trusting {brand} with your business&rsquo;s garage doors &mdash; we appreciate it, and we&rsquo;re glad to have helped keep things running.</p><p style="margin:0 0 16px 0;">Whenever you need us next &mdash; maintenance, repairs, or a new door &mdash; we&rsquo;re ready. Here&rsquo;s a little something off your next service call:</p>`,
   offer:true, closeTitle:"Thanks again for your business.", closeSub:"Mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'thank recent commercial customers and offer $25 off next service call', sw:WW,
   config:{ offer:{ amount:'$25', subhead:'Your next service call with us.', headline:'Thank You For Your Business', expires_days:null } },
   instructions:'Sends a thank-you and discount offer to commercial customers within 14 days of a completed job. Drives repeat bookings. Runs Mon-Fri 9AM-6PM. We suggest $25 off next service call.',
   delay:0, ae:{ segment:'recent_no_rebook', customer_type:'commercial', months:2, days_window:14, project_label:'your recent service', daily_limit:200, reenroll:60, notes:'Post-job thank-you, commercial, recent_no_rebook 2mo' } },

 { id:'07', camp:'Mark AI — Spring Maintenance (Residential)', tpl:'Spring Maintenance Email — Residential',
   subject:"Time for a spring garage door tune-up, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Spring is the perfect time for a garage door tune-up. Your door goes up and down thousands of times a year &mdash; a quick inspection catches worn springs, frayed cables, and loose hardware before they leave you stuck.</p><p style="margin:0 0 16px 0;">Our {brand} technicians test the balance, lubricate the moving parts, check the safety sensors, and keep {city} doors running smooth. And here&rsquo;s a little something off your service:</p>`,
   offer:true, closeTitle:"Keep it running smooth &mdash; book early.", closeSub:"Just mention this email when you call and we&rsquo;ll get you on the schedule.",
   goal:'seasonal', sw:WW,
   config:{ offer:Object.assign({},TIERED,{expires_days:60}) },
   instructions:'Contacts all dialable residential customers each spring (Mar-May). Tiered savings, rolls 200/day through the season. We suggest: $25 off $200+, $50 off $500+, $100 off $1,000+.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', season_start_month:3, season_end_month:5, project_label:'your home', daily_limit:200, reenroll:330, notes:'Spring Maintenance, residential, seasonal Mar-May — GATED draft' } },

 { id:'08', camp:'Mark AI — Summer Maintenance (Residential)', tpl:'Summer Maintenance Email — Residential',
   subject:"Keep your garage door running all summer, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Summer means the garage door gets a workout &mdash; kids in and out, projects, and the heat that&rsquo;s hard on openers and hardware. A quick tune-up keeps it running quiet and reliable all season.</p><p style="margin:0 0 16px 0;">Our {brand} technicians make sure {city} doors are ready. And here&rsquo;s a little something off your service:</p>`,
   offer:true, closeTitle:"Stay running smooth &mdash; book today.", closeSub:"Just mention this email when you call and we&rsquo;ll get you on the schedule.",
   goal:'seasonal', sw:WW,
   config:{ offer:Object.assign({},TIERED,{expires_days:60}) },
   instructions:'Contacts all dialable residential customers each summer (Jun-Aug). Tiered savings, rolls 100/day through the season. We suggest: $25 off $200+, $50 off $500+, $100 off $1,000+.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', season_start_month:6, season_end_month:8, project_label:'your home', daily_limit:100, reenroll:330, notes:'Summer Maintenance, residential, seasonal Jun-Aug — GATED draft' } },

 { id:'09', camp:'Mark AI — Fall Maintenance (Residential)', tpl:'Fall Maintenance Email — Residential',
   subject:"Get your garage door ready for winter, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">As the weather turns, fall is the time to get your garage door ready for winter &mdash; before the cold makes a worn spring or a sluggish opener worse. A tune-up keeps it opening dependably when you need it most.</p><p style="margin:0 0 16px 0;">Our {brand} technicians can inspect, adjust, and lubricate everything in one visit. And here&rsquo;s a little something off your service:</p>`,
   offer:true, closeTitle:"Get ahead of winter &mdash; book early.", closeSub:"Just mention this email when you call and we&rsquo;ll get you on the schedule.",
   goal:'seasonal', sw:WW,
   config:{ offer:Object.assign({},TIERED,{expires_days:60}) },
   instructions:'Contacts all dialable residential customers each fall (Sep-Nov). Tiered savings, rolls 200/day through the season. We suggest: $25 off $200+, $50 off $500+, $100 off $1,000+.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', season_start_month:9, season_end_month:11, project_label:'your home', daily_limit:200, reenroll:330, notes:'Fall Maintenance, residential, seasonal Sep-Nov — GATED draft' } },

 { id:'10', camp:'Mark AI — Winter Maintenance (Residential)', tpl:'Winter Maintenance Email — Residential',
   subject:"Don't get stuck this winter, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Winter is hard on garage doors &mdash; cold weather thickens the grease, stiffens the hardware, and is the worst time for a broken spring to leave your car stuck inside. A quick inspection helps you avoid getting stuck in the cold.</p><p style="margin:0 0 16px 0;">Our {brand} technicians help {city} doors stay dependable all winter. And here&rsquo;s a little something off your service:</p>`,
   offer:true, closeTitle:"Stay dependable all winter &mdash; book today.", closeSub:"Just mention this email when you call and we&rsquo;ll get you on the schedule.",
   goal:'seasonal', sw:WW,
   config:{ offer:Object.assign({},TIERED,{expires_days:60}) },
   instructions:'Contacts all dialable residential customers each winter (Dec-Feb). Tiered savings, rolls 200/day through the season. We suggest: $25 off $200+, $50 off $500+, $100 off $1,000+.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', season_start_month:12, season_end_month:2, project_label:'your home', daily_limit:200, reenroll:330, notes:'Winter Maintenance, residential, seasonal Dec-Feb — GATED draft' } },

 { id:'11', camp:"Mark AI — New Year's Sale (Residential)", tpl:"New Year's Sale Email — Residential",
   subject:"Happy New Year — {offerAmount} off garage door labor, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Happy New Year from {brand}! Start the year with a garage door that works like it should &mdash; a quieter opener, a smooth-running door, or a brand-new door that transforms your home&rsquo;s curb appeal.</p><p style="margin:0 0 16px 0;">For a limited time, we&rsquo;re taking a little off labor to help you get it done.</p>`,
   offer:true, closeTitle:"Start the year right &mdash; call to book.", closeSub:"Just mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'promo', sw:HW,
   config:{ offer:{ type:'percent', amount:'15', expires_days:14 } },
   instructions:"Blasts ALL residential customers Dec 30-Jan 5 (New Year's). Date-gated — fires automatically, stops Jan 6. We suggest 15-20% off labor.",
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', promo_start:'2026-12-30', promo_end:'2027-01-05', promo_holiday:'new_years', project_label:'your home', daily_limit:9999, reenroll:330, notes:"New Year's Sale — promo Dec30-Jan5 — GATED draft" } },

 { id:'12', camp:'Mark AI — Presidents Day Sale (Residential)', tpl:'Presidents Day Sale Email — Residential',
   subject:"Presidents Day Savings on garage door labor, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Presidents Day is a great time to tackle that garage door project &mdash; a worn spring, a noisy opener, new rollers, or finally replacing that tired old door.</p><p style="margin:0 0 16px 0;">For a limited time, {brand} is offering tiered savings on labor &mdash; the more you book, the more you save.</p>`,
   offer:true, closeTitle:"Make it happen &mdash; call to book.", closeSub:"Just mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'promo', sw:HW,
   config:{ offer:Object.assign({},TIERED,{expires_days:14}) },
   instructions:'Blasts ALL residential customers Feb 12-16 (Presidents Day weekend). Date-gated — fires automatically, stops Feb 17. We suggest tiered labor savings.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', promo_start:'2027-02-12', promo_end:'2027-02-16', promo_holiday:'presidents_day', project_label:'your home', daily_limit:9999, reenroll:330, notes:'Presidents Day Sale — promo Feb12-16 — GATED draft' } },

 { id:'13', camp:'Mark AI — Memorial Day Sale (Residential)', tpl:'Memorial Day Sale Email — Residential',
   subject:"Memorial Day — {offerAmount} off garage door labor, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Kick off the season with a garage door you&rsquo;re proud to come home to &mdash; a repair, a tune-up, or a brand-new door.</p><p style="margin:0 0 16px 0;">For a limited time, {brand} is taking a little off labor.</p>`,
   offer:true, closeTitle:"Call to lock in your savings.", closeSub:"Just mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'promo', sw:HW,
   config:{ offer:{ type:'percent', amount:'15', expires_days:14 } },
   instructions:'Blasts ALL residential customers May 28-Jun 1 (Memorial Day weekend). Date-gated — fires automatically, stops Jun 2. We suggest 15-20% off labor.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', promo_start:'2027-05-28', promo_end:'2027-06-01', promo_holiday:'memorial_day', project_label:'your home', daily_limit:9999, reenroll:330, notes:'Memorial Day Sale — promo May28-Jun1 — GATED draft' } },

 { id:'14', camp:'Mark AI — July 4th Sale (Residential)', tpl:'July 4th Sale Email — Residential',
   subject:"July 4th — {offerAmount} off garage door labor, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Celebrate the 4th with a garage door that works beautifully &mdash; a repair, a new opener, or a full door replacement that boosts your curb appeal.</p><p style="margin:0 0 16px 0;">For a limited time, {brand} is taking a nice chunk off labor on bigger jobs.</p>`,
   offer:true, closeTitle:"Celebrate with savings &mdash; call today.", closeSub:"Just mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'promo', sw:HW,
   config:{ offer:{ type:'flat', amount:'$250', expires_days:14 } },
   instructions:'Blasts ALL residential customers Jun 30-Jul 6 (4th of July). Date-gated — fires automatically, stops Jul 7. We suggest 15-20% off or flat dollar off bigger jobs.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', promo_start:'2027-06-30', promo_end:'2027-07-06', promo_holiday:'july_4', project_label:'your home', daily_limit:9999, reenroll:330, notes:'July 4th Sale — promo Jun30-Jul6 — GATED draft' } },

 { id:'15', camp:'Mark AI — Labor Day Sale (Residential)', tpl:'Labor Day Sale Email — Residential',
   subject:"Labor Day — {offerAmount} off garage door labor, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Labor Day is here, and it&rsquo;s the perfect time to get your garage door set before the seasons change &mdash; a tune-up, a spring or opener repair, or a new door.</p><p style="margin:0 0 16px 0;">For a limited time, {brand} is taking a little off labor.</p>`,
   offer:true, closeTitle:"Spots fill fast over the long weekend &mdash; call today.", closeSub:"Just mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'promo', sw:HW,
   config:{ offer:{ type:'percent', amount:'15', expires_days:14 } },
   instructions:'Blasts ALL residential customers Aug 29-Sep 7 (Labor Day weekend). Date-gated — fires automatically, stops Sep 8. We suggest 15-20% off labor.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', promo_start:'2027-08-28', promo_end:'2027-09-06', promo_holiday:'labor_day', project_label:'your home', daily_limit:9999, reenroll:330, notes:'Labor Day Sale — promo Aug29-Sep7 — GATED draft' } },

 { id:'16', camp:'Mark AI — Black Friday Sale (Residential)', tpl:'Black Friday Sale Email — Residential',
   subject:"Black Friday — {offerAmount} off garage door labor this week, {firstName}",
   copy:`<p style="margin:0 0 16px 0;">Black Friday is here &mdash; and {brand} is bringing our biggest garage door savings of the year. If there&rsquo;s a repair, an opener, or a brand-new door you&rsquo;ve been waiting on, now&rsquo;s the time to lock it in.</p><p style="margin:0 0 16px 0;">For a limited time, take the savings on labor.</p>`,
   offer:true, closeTitle:"Our biggest savings of the year &mdash; call today.", closeSub:"Just mention this email when you call and we&rsquo;ll get you scheduled.",
   goal:'promo', sw:HW,
   config:{ offer:{ type:'threshold', amount:'$50', min_spend:'$500', expires_days:14 } },
   instructions:'Blasts ALL residential customers Nov 25-Dec 1 (Black Friday week). Date-gated — fires automatically, stops Dec 2. This is typically your biggest offer of the year. We suggest 15-20% off labor.',
   delay:0, ae:{ segment:'all_dialable', customer_type:'residential', promo_start:'2026-11-25', promo_end:'2026-12-01', promo_holiday:'black_friday', project_label:'your home', daily_limit:9999, reenroll:330, notes:'Black Friday Sale — promo Nov25-Dec1 — GATED draft' } },
];

async function upsertTemplate(PD, name, subject, bodyHtml){
  const ex = await q("SELECT id FROM drip_templates WHERE franchise_id=$1 AND channel='email' AND name=$2",[PD,name]);
  if(ex.rows[0]){ await q("UPDATE drip_templates SET subject=$2, body=$3, updated_at=now() WHERE id=$1",[ex.rows[0].id,subject,bodyHtml]); return ex.rows[0].id; }
  const ins = await q("INSERT INTO drip_templates(franchise_id,name,channel,subject,body,created_at,updated_at) VALUES($1,$2,'email',$3,$4,now(),now()) RETURNING id",[PD,name,subject,bodyHtml]);
  return ins.rows[0].id;
}
async function upsertCampaign(PD, name, goal, config, instructions){
  const cfg = JSON.stringify(config);
  const ex = await q("SELECT id FROM drip_campaigns WHERE franchise_id=$1 AND name=$2",[PD,name]);
  if(ex.rows[0]){ await q("UPDATE drip_campaigns SET goal=$2, channels=$3, config=$4::jsonb, instructions=$5, approval_status='draft', status='draft', created_by='pd-master-loader', updated_at=now() WHERE id=$1",[ex.rows[0].id,goal,['email'],cfg,instructions]); return ex.rows[0].id; }
  const ins = await q("INSERT INTO drip_campaigns(franchise_id,name,goal,segment_id,channels,approval_status,created_by,config,status,instructions,attribution_days,created_at,updated_at) VALUES($1,$2,$3,NULL,$4,'draft','pd-master-loader',$5::jsonb,'draft',$6,60,now(),now()) RETURNING id",[PD,name,goal,['email'],cfg,instructions]);
  return ins.rows[0].id;
}
async function setStep(cid, tid, delay){
  await q("DELETE FROM drip_steps WHERE campaign_id=$1",[cid]);
  await q("INSERT INTO drip_steps(campaign_id,step_index,channel,delay_hours,template_id,send_window,branch_on_outcome,enabled,created_at) VALUES($1,0,'email',$2,$3,NULL,'{}'::jsonb,true,now())",[cid,delay,tid]);
}
async function setAutoenroll(PD, cid, ae){
  await q("DELETE FROM drip_autoenroll_map WHERE franchise_id=$1 AND campaign_id=$2",[PD,cid]);
  await q(`INSERT INTO drip_autoenroll_map
    (franchise_id,segment,campaign_id,months,channel_need,project_label,daily_limit,enabled,notes,customer_type,season_start_month,season_end_month,promo_start_date,promo_end_date,days_window,sms_daily_limit,reenroll_after_days,promo_holiday,created_at,updated_at)
    VALUES($1,$2,$3,$4,'email',$5,$6,false,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,now(),now())`,
    [PD, ae.segment, cid, ae.months||null, ae.project_label, ae.daily_limit,
     ae.notes, ae.customer_type, ae.season_start_month||null, ae.season_end_month||null,
     ae.promo_start||null, ae.promo_end||null, ae.days_window||null, ae.reenroll||null, ae.promo_holiday||null]);
}

(async()=>{
  const fr = await q("SELECT id FROM franchises WHERE slug='precision-door-demo'");
  if(!fr.rows[0]){ console.log('ERR precision-door-demo franchise not found — run _pd_art.cjs first'); process.exit(1); }
  const PD = fr.rows[0].id;
  console.log('Loading into precision-door-demo id='+PD);
  for(const e of D){
    const cfg = Object.assign({}, e.config, { send_window:e.sw, st_campaign_name:e.camp });
    const tid = await upsertTemplate(PD, e.tpl, e.subject, body(e));
    const cid = await upsertCampaign(PD, e.camp, e.goal, cfg, e.instructions);
    await setStep(cid, tid, e.delay);
    await setAutoenroll(PD, cid, e.ae);
    console.log('OK '+e.id+'  camp='+cid+' tpl='+tid+'  '+e.camp);
  }
  const t = await q("SELECT count(*)::int n FROM drip_templates WHERE franchise_id=$1 AND channel='email'",[PD]);
  const c = await q("SELECT count(*)::int n FROM drip_campaigns WHERE franchise_id=$1 AND created_by='pd-master-loader'",[PD]);
  const a = await q("SELECT count(*)::int n FROM drip_autoenroll_map WHERE franchise_id=$1",[PD]);
  console.log('\nPD master now has: '+t.rows[0].n+' email templates, '+c.rows[0].n+' campaigns, '+a.rows[0].n+' autoenroll rows (all enabled=false/draft)');
  await pool.end();
  console.log('LOAD_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });

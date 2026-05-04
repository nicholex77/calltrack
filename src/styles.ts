export const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Geist',system-ui,sans-serif;background:#fff;color:#111;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
textarea,input,select{font-family:inherit;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pop{0%{transform:scale(.95);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.fade-up{animation:fadeUp .22s ease both;}
.fade-in{animation:fadeIn .18s ease both;}
.pop{animation:pop .18s ease both;}
.shake{animation:shake .35s ease;}
.card{background:#fff;border:1.5px solid #ebebeb;border-radius:16px;overflow:hidden;}
.card-sm{background:#fafafa;border:1.5px solid #ebebeb;border-radius:12px;padding:14px;}
.task-chip{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;transition:all .12s;border:1.5px solid transparent;margin-bottom:5px;}
.task-chip:hover{background:#f7f7f7;}
.task-chip.active{background:#eff6ff;border-color:#bfdbfe;}
.counter-btn{width:30px;height:30px;border-radius:8px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;color:#555;transition:all .12s;flex-shrink:0;}
.counter-btn:hover{background:#1a56db;color:#fff;border-color:#1a56db;}
.counter-btn:active{transform:scale(.95);}
.counter-btn.sm{width:24px;height:24px;border-radius:6px;font-size:13px;}
.num-input{border:1.5px solid #e5e5e5;border-radius:10px;font-size:20px;font-weight:700;text-align:center;padding:7px 2px;font-family:inherit;outline:none;transition:border-color .15s;color:#111;background:#fff;width:100%;min-width:0;}
.num-input:focus{border-color:#1a56db;}
.num-input.sm{font-size:15px;padding:5px 2px;border-radius:8px;}
.primary-btn{background:#1a56db;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;}
.primary-btn:hover{background:#1447c0;}
.primary-btn:active{transform:scale(.97);}
.primary-btn:disabled{opacity:.35;cursor:not-allowed;}
.green-btn{background:#059669;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;}
.green-btn:hover{background:#047857;}
.ghost-btn{background:#fff;color:#555;border:1.5px solid #e5e5e5;border-radius:10px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .12s;}
.ghost-btn:hover{border-color:#1a56db;color:#1a56db;}
.danger-btn{background:none;border:none;color:#ccc;font-size:12px;cursor:pointer;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;}
.danger-btn:hover{background:#fee2e2;color:#ef4444;}
.save-btn{background:#fff;color:#1a56db;border:1.5px solid #1a56db;border-radius:10px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s;}
.save-btn:hover{background:#1a56db;color:#fff;}
.saved-btn{background:#1a56db;color:#fff;border:1.5px solid #1a56db;border-radius:10px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease;padding:20px;}
.modal{background:#fff;border-radius:20px;padding:26px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.15);animation:pop .18s ease;max-height:90vh;overflow-y:auto;}
.text-input{border:1.5px solid #444;border-radius:10px;padding:10px 13px;font-family:inherit;font-size:14px;color:#fff;background:#1a1a1a;outline:none;transition:border-color .15s;width:100%;}
.text-input:focus{border-color:#1a56db;}
.text-input::placeholder{color:#666;}
.remarks-ta{border:1.5px solid #444;border-radius:10px;padding:10px 13px;font-family:inherit;font-size:13px;color:#fff;background:#1a1a1a;resize:vertical;outline:none;transition:border-color .15s;line-height:1.6;width:100%;}
.remarks-ta:focus{border-color:#1a56db;}
.remarks-ta::placeholder{color:#bbb;}
.progress-track{height:6px;border-radius:99px;background:#f0f0f0;overflow:hidden;}
.progress-fill{height:100%;border-radius:99px;transition:width .4s ease,background .3s ease;}
.stat-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;}
.type-btn{padding:7px 13px;border-radius:9px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;transition:all .1s;color:#555;}
.type-btn.active{background:#1a56db;border-color:#1a56db;color:#fff;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:600;z-index:200;animation:fadeUp .2s ease;white-space:nowrap;pointer-events:none;}
.export-table{width:100%;border-collapse:collapse;font-size:12px;}
.export-table th{background:#1a56db;color:#fff;padding:8px 12px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}
.export-table td{padding:8px 12px;border-bottom:1px solid #f0f0f0;white-space:nowrap;}
.export-table tr:hover td{background:#eff6ff;}
.tab-btn{padding:8px 16px;border-radius:9px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:all .12s;color:#555;}
.tab-btn.active{background:#1a56db;border-color:#1a56db;color:#fff;}
.pin-box{width:38px;height:46px;border:2px solid #333;border-radius:10px;font-size:20px;font-weight:800;text-align:center;font-family:inherit;outline:none;transition:border-color .15s,background .15s;background:#111;color:#fff;caret-color:transparent;}
.pin-box:focus{border-color:#1a56db;background:#222;}
.pin-box.error{border-color:#ef4444;background:#7f1d1d;}
.role-card{border:2px solid #e5e5e5;border-radius:20px;padding:28px 20px;cursor:pointer;transition:all .12s;text-align:center;flex:1;user-select:none;}
.role-card:hover{border-color:#1a56db;background:#eff6ff;}
.role-card:active{transform:scale(.96);background:#1a56db;color:#fff;border-color:#1a56db;}
.weekly-tab{padding:9px 20px;border-radius:10px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;transition:all .12s;color:#555;}
.weekly-tab:hover{border-color:#1a56db;color:#1a56db;}
.weekly-tab.active{background:#1a56db;border-color:#1a56db;color:#fff;}
.summary-stat{background:#fafafa;border:1.5px solid #ebebeb;border-radius:14px;padding:16px;text-align:center;}
.conv-summary-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;}
.conv-summary-table th{background:#1a1a1a;color:#fff;padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.conv-summary-table td{padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;}
.conv-summary-table tr:last-child td{border-bottom:none;}
.conv-summary-table .highlight{color:#1a56db;font-size:15px;font-weight:800;}
.confirm-modal{background:#fff;border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.18);animation:pop .18s ease;}
.danger-solid-btn{background:#ef4444;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;}
.danger-solid-btn:hover{background:#dc2626;}
.unsaved-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;margin-left:5px;vertical-align:middle;flex-shrink:0;}
.lb-row{display:grid;grid-template-columns:32px 1fr 70px 70px 70px 80px;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #f5f5f5;}
.lb-row:last-child{border-bottom:none;}
.member-pick-card{border:1.5px solid #e5e5e5;border-radius:14px;padding:14px 16px;cursor:pointer;transition:all .12s;display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.member-pick-card:hover{border-color:#1a56db;background:#eff6ff;}
.title-input{border:none;border-bottom:2px solid #1a56db;border-radius:0;padding:2px 4px;font-family:inherit;font-size:16px;font-weight:800;color:#111;background:transparent;outline:none;width:100%;letter-spacing:-.3px;}
.title-input::placeholder{color:#bbb;}
.sidebar-toggle{background:none;border:1.5px solid #e5e5e5;border-radius:8px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#888;transition:all .12s;flex-shrink:0;}
.sidebar-toggle:hover{border-color:#1a56db;color:#1a56db;}
@media(max-width:768px){
  .desktop-nav{display:none!important;}
  .daily-grid{grid-template-columns:1fr!important;}
  .sidebar-panel{display:none;}
  .sidebar-panel.open{display:block;}
  .detail-panel{min-height:0;}
  .desktop-only{display:none!important;}
  .mobile-full{width:100%!important;}
  .page-wrap{padding:16px 14px 80px!important;}
  .weekly-grid{grid-template-columns:repeat(4,1fr)!important;}
  .modal{padding:20px 16px;}
  .lb-row{grid-template-columns:28px 1fr 56px 56px;gap:4px;}
  .lb-row>div:nth-child(4),.lb-row>div:nth-child(5){display:none;}
  .mobile-task-bar{display:flex!important;flex-direction:column;}
}
@media(max-width:480px){
  .weekly-grid{grid-template-columns:repeat(2,1fr)!important;}
  .stat-grid-4{grid-template-columns:repeat(2,1fr)!important;}
  .perf-grid{grid-template-columns:1fr!important;}
}
.pipeline-wrap{display:flex;gap:14px;align-items:flex-start;overflow-x:auto;padding-bottom:20px;}
.pipeline-col{flex:1;min-width:220px;border-radius:14px;overflow:hidden;border:2px solid transparent;transition:border-color .15s;}
.pipeline-col.drag-over{border-color:currentColor;}
.pipeline-col-body{padding:10px;display:flex;flex-direction:column;gap:8px;min-height:120px;max-height:calc(100vh - 240px);overflow-y:auto;}
.pipeline-col-body.drag-over{background:#f0f6ff;}
.pipeline-card{background:#fff;border:1.5px solid #ebebeb;border-radius:10px;padding:10px 12px;cursor:grab;transition:box-shadow .12s,opacity .15s;user-select:none;}
.pipeline-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);border-color:#bfdbfe;}
.pipeline-card:active{cursor:grabbing;}
.stale-fresh{color:#059669;background:#f0fdf4;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;}
.stale-warn{color:#d97706;background:#fffbeb;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;}
.stale-old{color:#dc2626;background:#fff1f2;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;}
.notes-feed{display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;margin-bottom:8px;}
.note-item{background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:7px 10px;}
.note-meta{font-size:10px;color:#aaa;display:flex;justify-content:space-between;margin-bottom:2px;}
.note-text{font-size:12px;color:#333;line-height:1.5;word-break:break-word;}
@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
.swipe-strip{position:absolute;right:0;top:0;bottom:0;width:76px;display:flex;flex-direction:column;gap:3px;padding:5px 4px;border-radius:0 10px 10px 0;animation:slideInRight .15s ease;}
.history-feed{display:flex;flex-direction:column;gap:3px;max-height:120px;overflow-y:auto;}
.history-item{border-left:2px solid #e5e5e5;padding:3px 0 3px 9px;}
.history-meta{font-size:10px;color:#aaa;margin-bottom:1px;}
.history-text{font-size:11px;color:#555;font-weight:600;}
.stats-tab-bar{display:flex;gap:4px;background:#f5f5f5;border-radius:10px;padding:3px;margin-bottom:20px;width:fit-content;}
.stats-tab{padding:6px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:transparent;color:#888;transition:all .12s;}
.stats-tab.active{background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.app-shell{min-height:100vh;background:#fff;display:flex;flex-direction:column;}
.shell-topbar{height:56px;border-bottom:1px solid #ebebeb;background:#fff;position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 24px;gap:12px;flex-shrink:0;}
.shell-body{display:flex;flex:1;min-height:0;position:relative;}
.sidebar{width:220px;background:#fff;border-right:1px solid #ebebeb;padding:14px 10px;display:flex;flex-direction:column;gap:2px;flex-shrink:0;position:sticky;top:56px;height:calc(100vh - 56px);overflow-y:auto;}
.sidebar-link{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;font-family:inherit;color:#555;transition:all .12s;text-align:left;width:100%;}
.sidebar-link:hover{background:#eff6ff;color:#1a56db;}
.sidebar-link.active{background:#1a56db;color:#fff;}
.sidebar-link svg{flex-shrink:0;}
.shell-content{flex:1;min-width:0;padding:24px 32px 80px;overflow-x:hidden;}
.sync-pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#f7f7f7;color:#666;white-space:nowrap;}
.sync-pill.synced{background:#ecfdf5;color:#059669;}
.sync-pill.syncing{background:#fffbeb;color:#d97706;}
.sync-pill.error{background:#fff1f2;color:#dc2626;}
.sync-pill.offline{background:#fef2f2;color:#991b1b;}
.shell-hamburger{display:none;background:none;border:1.5px solid #e5e5e5;border-radius:8px;width:34px;height:34px;cursor:pointer;align-items:center;justify-content:center;color:#555;padding:0;flex-shrink:0;}
.shell-hamburger:hover{border-color:#1a56db;color:#1a56db;}
.sidebar-backdrop{display:none;}
@media(max-width:768px){
  .shell-hamburger{display:flex;}
  .shell-topbar{padding:0 14px;}
  .shell-content{padding:16px 14px 80px;}
  .sidebar{position:fixed;top:0;left:0;height:100vh;z-index:60;transform:translateX(-100%);transition:transform .2s ease;padding-top:18px;width:240px;}
  .sidebar.open{transform:translateX(0);box-shadow:4px 0 24px rgba(0,0,0,.12);}
  .sidebar-backdrop{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:55;opacity:0;pointer-events:none;transition:opacity .15s;}
  .sidebar-backdrop.open{opacity:1;pointer-events:auto;}
}
`;

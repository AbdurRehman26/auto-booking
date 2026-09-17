<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f5f4ef" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>TerminPilot — Appointment workflows</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('styles.css') }}" />
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="TerminPilot home">
          <span class="brand-mark"><span></span><span></span><span></span></span>
          <span>TerminPilot</span>
        </a>
        <div class="top-actions">
          <span class="status"><i></i> Local only</span>
          <button class="icon-btn" id="themeBtn" aria-label="Toggle theme">◐</button>
          <button class="avatar" aria-label="Profile">SK</button>
        </div>
      </header>

      <main>
        <section class="intro">
          <div>
            <div class="eyebrow">AUTOMATION STUDIO</div>
            <h1>Build a booking flow.<br><em>Keep the final say.</em></h1>
            <p>Describe the journey in plain language, then review each action before your workflow touches the booking site.</p>
          </div>
          <div class="intro-actions">
            <button class="btn secondary" id="newFlowBtn">＋ New flow</button>
            <button class="btn primary" id="runBtn"><span>▶</span> Test run</button>
          </div>
        </section>

        <section class="workspace">
          <aside class="sidebar">
            <div class="side-heading"><span>YOUR FLOWS</span><button id="addFlowSmall" aria-label="Add flow">＋</button></div>
            <div id="flowList" class="flow-list"></div>
            <div class="side-note">
              <div class="shield">✓</div>
              <div><strong>Human checkpoint</strong><p>TerminPilot always pauses before a final submission or CAPTCHA.</p></div>
            </div>
          </aside>

          <section class="canvas">
            <div class="canvas-head">
              <div>
                <div class="title-row"><input id="flowName" value="Düsseldorf driving licence" aria-label="Workflow name"><span class="pill">DRAFT</span></div>
                <p id="flowMeta">6 steps · Edited just now</p>
              </div>
              <div class="canvas-tools">
                <button class="ghost" id="copyBtn">Copy</button>
                <button class="ghost danger" id="deleteBtn">Delete</button>
              </div>
            </div>

            <div class="mode-switch" role="tablist">
              <button class="active" data-mode="visual" role="tab">Visual builder</button>
              <button data-mode="text" role="tab">Write as text</button>
            </div>

            <div id="visualMode">
              <div id="steps" class="steps"></div>
              <button class="add-step" id="addStepBtn"><span>＋</span> Add another step</button>
            </div>

            <div id="textMode" class="text-mode hidden">
              <label for="flowText">One instruction per line</label>
              <textarea id="flowText" spellcheck="false"></textarea>
              <div class="text-help"><span>Try “Go to…”, “Click…”, “Check if…”, “Enter…” or “Pause for approval”.</span><button class="btn primary compact" id="applyTextBtn">Build flow</button></div>
            </div>
          </section>

          <aside class="inspector">
            <div class="inspector-head"><span>FLOW SETTINGS</span></div>
            <label class="field"><span>Start URL</span><input id="startUrl" type="url"></label>
            <label class="field"><span>Check interval</span><select id="interval"><option>Every 5 minutes</option><option>Every 15 minutes</option><option>Every 30 minutes</option><option>Manual only</option></select></label>
            <div class="toggle-row"><div><strong>Pause on errors</strong><small>Wait for your input</small></div><button class="toggle on" id="pauseToggle" aria-label="Pause on errors"><i></i></button></div>
            <div class="toggle-row"><div><strong>Final review</strong><small>Required before booking</small></div><button class="toggle on locked" aria-label="Final review locked"><i></i></button></div>
            <div class="divider"></div>
            <div class="readiness"><div class="ring"><span id="score">92</span><small>%</small></div><div><strong>Ready to test</strong><p id="readinessText">All steps look valid.</p></div></div>
            <div class="notify-panel">
              <div class="notify-title"><span>NOTIFICATIONS</span><button id="addNotifyBtn">＋ Add</button></div>
              <div id="notificationList" class="notification-list"></div>
            </div>
            <button class="btn dark full" id="openSiteBtn">Open booking site ↗</button>
            <p class="legal">No background booking is performed by this prototype. The city site opens in a separate tab for user-supervised completion.</p>
          </aside>
        </section>
      </main>
    </div>

    <div class="modal-backdrop hidden" id="runModal">
      <div class="run-modal" role="dialog" aria-modal="true" aria-labelledby="runTitle">
        <div class="run-head"><div><span class="live-dot"></span><span>TEST SESSION</span></div><button id="closeRun" aria-label="Close">×</button></div>
        <h2 id="runTitle">Checking your workflow</h2>
        <p class="run-sub">This is a safe simulation. No information will be submitted.</p>
        <div class="progress-track"><i id="progressBar"></i></div>
        <div id="runSteps" class="run-steps"></div>
        <div class="run-footer"><span id="runStatus">Preparing…</span><button class="btn secondary compact" id="stopRun">Stop test</button></div>
      </div>
    </div>

    <div class="modal-backdrop hidden" id="notifyModal">
      <div class="notify-modal" role="dialog" aria-modal="true" aria-labelledby="notifyTitle">
        <div class="run-head"><div><span class="live-dot"></span><span>NOTIFICATION RULE</span></div><button id="closeNotify" aria-label="Close">×</button></div>
        <h2 id="notifyTitle">Add a notification</h2>
        <p class="run-sub">Choose when it fires and where it should be delivered.</p>
        <div class="notify-grid">
          <label class="field"><span>Channel</span><select id="notifyChannel"><option value="email">Email</option><option value="slack">Slack webhook</option><option value="whatsapp">WhatsApp</option><option value="webhook">Generic webhook</option></select></label>
          <label class="field"><span>Trigger</span><select id="notifyTrigger"><option value="failure">When any step fails</option><option value="availability">When availability is found</option><option value="complete">When the flow completes</option><option value="step">After a specific step</option></select></label>
        </div>
        <label class="field hidden" id="stepTargetField"><span>After step</span><select id="notifyStep"></select></label>
        <label class="field"><span id="destinationLabel">Email address</span><input id="notifyDestination" autocomplete="off" placeholder="you@example.com"></label>
        <label class="field"><span>Message</span><textarea id="notifyMessage" rows="3" placeholder="Appointment update: @{{flow_name}}"></textarea></label>
        <div class="variables"><span>Variables</span><button data-var="@{{flow_name}}">flow_name</button><button data-var="@{{step_name}}">step_name</button><button data-var="@{{status}}">status</button><button data-var="@{{booking_url}}">booking_url</button></div>
        <div class="security-note">Credentials stay in this browser. Delivery is simulated during test runs.</div>
        <div class="modal-actions"><button class="btn secondary" id="cancelNotify">Cancel</button><button class="btn primary" id="saveNotify">Save notification</button></div>
      </div>
    </div>

    <div id="toast" class="toast" role="status"></div>
    <script type="module" src="{{ asset('app.js') }}"></script>
  </body>
</html>

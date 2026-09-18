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
          <span class="account-email">{{ auth()->user()->email }}</span>
          <form method="POST" action="/logout">@csrf<button class="btn secondary" type="submit">Sign out</button></form>
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
            <label class="delivery-choice"><input id="deliverNotifications" type="checkbox"> Send real notifications during this test</label>
          </div>
        </section>

        <section class="workspace">
          <aside class="sidebar">
            <nav class="sidebar-menu" aria-label="Main navigation">
              <button id="myFlowsNav" class="active" aria-current="page">▤ <span>My flows</span></button>
              <button id="channelsNav">↗ <span>Channels</span></button>
              <button id="scheduledRunsNav">◷ <span>Scheduled runs</span></button>
              <button id="recordsNav">▤ <span>Saved records</span></button>
            </nav>
            <div class="side-heading"><span>YOUR FLOWS</span><button id="addFlowSmall" aria-label="Add flow">＋</button></div>
            <div id="flowList" class="flow-list"></div>
            <div class="side-note">
              <div class="shield">✓</div>
              <div><strong>Human checkpoint</strong><p>TerminPilot always pauses before a final submission or CAPTCHA.</p></div>
            </div>
          </aside>

          <section id="scheduledRunsPage" class="channels-page hidden"><div class="channels-heading"><h2>Scheduled runs</h2><button id="refreshScheduledRuns" class="btn secondary">Refresh</button></div><div id="scheduledRunsList" class="channels-list"></div><div class="modal-actions"><button id="previousScheduledRuns" class="btn secondary">Previous</button><button id="nextScheduledRuns" class="btn secondary">Next</button></div></section>
          <section id="recordsPage" class="channels-page hidden">
            <div class="channels-heading"><div><div class="eyebrow">RUN HISTORY</div><h2>Saved records</h2><p>Messages saved by your workflow steps.</p></div><button class="btn secondary" id="refreshRecords">Refresh</button></div>
            <div id="recordsList" class="channels-list"></div>
            <div class="modal-actions"><button id="recordsPrevious" class="btn secondary">Previous</button><button id="recordsNext" class="btn secondary">Next</button></div>
          </section>
          <section id="channelsPage" class="channels-page hidden" aria-labelledby="channelsTitle">
            <div class="channels-heading"><div><div class="eyebrow">CONNECTIONS</div><h2 id="channelsTitle">Channels</h2><p>Save destinations to reuse in your notification steps.</p></div><button id="newChannelBtn" class="btn primary">＋ Add channel</button></div>
            <form id="channelForm" class="channel-form hidden">
              <h3 id="channelFormTitle">Add channel</h3>
              <label class="field"><span>Name</span><input id="channelName" maxlength="160" placeholder="Team alerts" required></label>
              <label class="field"><span>Provider</span><select id="channelProvider"></select></label>
              <label class="field"><span id="channelDestinationLabel">Destination</span><input id="channelDestination" maxlength="2000" required autocomplete="off"></label>
              <p id="channelHelp" class="condition-help"></p>
              <p id="channelError" role="alert" class="auth-error hidden"></p>
              <div class="modal-actions"><button id="cancelChannel" type="button" class="btn secondary">Cancel</button><button id="saveChannel" type="submit" class="btn primary">Save channel</button></div>
            </form>
            <div id="channelsList" class="channels-list"></div>
          </section>
          <section class="canvas">
            <div class="canvas-head">
              <div>
                <div class="title-row"><input id="flowName" value="" aria-label="Workflow name"><span id="workflowStatus" class="pill">PAUSED</span></div>
                <button id="activateFlow" class="btn primary workflow-activation" type="button" aria-pressed="false">Activate workflow</button>
                <p id="activationError" class="condition-help hidden" role="alert"></p>
                <p id="flowMeta">Loading from database…</p>
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
              <p id="reorderHelp" class="reorder-help">Drag the grip to rearrange steps. On a focused grip, use ↑ / ↓ to move.</p>
              <div id="reorderStatus" class="sr-only" role="status" aria-live="polite"></div>
              <div id="steps" class="steps"></div>
              <button class="add-step" id="addStepBtn" aria-expanded="false" aria-controls="stepPicker"><span>＋</span> Add another step</button>
              <section id="stepPicker" class="step-picker hidden" aria-label="Choose a step type">
                <div class="step-picker-head"><strong>What should happen next?</strong><button id="closeStepPicker" aria-label="Close step picker">×</button></div>
                <div id="stepChoices" class="step-choices"></div>
              </section>
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
            <label class="field"><span>Days / date</span><select id="interval"></select></label>
            <div id="scheduleFields"></div>
            <label class="delivery-choice"><input id="scheduleEnabled" type="checkbox"> Enable scheduled runs</label>
            <label class="delivery-choice"><input id="scheduledNotifications" type="checkbox"> Send real notifications in scheduled runs</label>
            <p class="condition-help">Runs while this computer is awake. Human checkpoints pause scheduling. “Pause on errors” also pauses scheduling after a failed run.</p>
            <div class="toggle-row"><div><strong>Pause on errors</strong><small>Wait for your input</small></div><button class="toggle on" id="pauseToggle" aria-label="Pause on errors"><i></i></button></div>
            <div class="toggle-row"><div><strong>Final review</strong><small>Required before booking</small></div><button class="toggle on locked" aria-label="Final review locked"><i></i></button></div>
            <div class="divider"></div>
            <div class="readiness"><div class="ring"><span id="score">92</span><small>%</small></div><div><strong>Ready to test</strong><p id="readinessText">All steps look valid.</p></div></div>
            <div class="notify-panel">
              <div class="notify-title"><span>NOTIFICATIONS</span><button id="addNotifyBtn">＋ Add</button></div>
              <div id="notificationList" class="notification-list"></div>
            </div>
            <button class="btn dark full" id="openSiteBtn">Open booking site ↗</button>
            <p class="legal">Test runs open a real browser with a live preview. Personal information and booking submissions require your review on the city site.</p>
          </aside>
        </section>
      </main>
    </div>

    <div class="modal-backdrop hidden" id="runModal">
      <div class="run-modal" role="dialog" aria-modal="true" aria-labelledby="runTitle">
        <div class="run-head"><div><span class="live-dot"></span><span>TEST SESSION</span></div><button id="closeRun" aria-label="Close">×</button></div>
        <h2 id="runTitle">Live browser preview</h2>
        <p class="run-sub">Watch the actual website as each step runs. Next, Weiter, Continue, and modal OK can load the next screen. Personal information and final booking still require review.</p>
        <div class="progress-track"><i id="progressBar"></i></div>
        <div class="run-layout">
          <section class="browser-preview" aria-label="Live browser preview">
            <div class="browser-toolbar"><span class="browser-dots" aria-hidden="true">● ● ●</span><span id="previewUrl">Opening browser…</span><span class="preview-badge" id="previewBadge">STARTING</span></div>
            <div class="preview-screen">
              <div id="previewEmpty" class="preview-empty"><span>↗</span><strong>Opening a fresh browser</strong><p>The real booking page will appear here.</p></div>
              <img id="previewFrame" class="hidden" alt="Latest screenshot from the test browser" />
            </div>
            <p id="networkNotice" class="run-sub hidden" role="status"></p>
            <p id="cookieNotice" class="run-sub hidden" role="status"></p>
            <div class="preview-caption"><span id="previewTime">Waiting for first screenshot</span><span>1280 × 800 · Read-only preview</span></div>
          </section>
          <aside class="run-activity"><div class="activity-heading">STEP ACTIVITY <span id="runCount"></span></div><div id="runSteps" class="run-steps"></div><p class="run-tip">Use exact page labels: Click “Weiter” or Check “Available appointments”. General instructions pause for clarification.</p></aside>
        </div>
        <div class="run-footer"><span id="runStatus" role="status" aria-live="polite">Preparing…</span><div class="run-controls"><button class="btn secondary compact hidden" id="retryRun">Run again</button><button class="btn secondary compact" id="stopRun">Stop test</button></div></div>
      </div>
    </div>

    <div class="modal-backdrop hidden" id="notifyModal">
      <div class="notify-modal" role="dialog" aria-modal="true" aria-labelledby="notifyTitle">
        <div class="run-head"><div><span class="live-dot"></span><span>NOTIFICATION RULE</span></div><button id="closeNotify" aria-label="Close">×</button></div>
        <h2 id="notifyTitle">Add a notification</h2>
        <p class="run-sub">Choose when it fires and where it should be delivered.</p>
        <div class="notify-grid">
          <label class="field"><span>Channel</span><select id="notifyChannel"></select></label>
          <label class="field"><span>Trigger</span><select id="notifyTrigger"></select></label>
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

import { redeemCode } from "/MKJ/assets/js/core/redeem.js";

/* MKJ 单页应用逻辑：题目、评分、雷达图、动效与内容模块均在此集中管理。 */
(function(){
  "use strict";

  const mkj$ = (selector, root = document) => root.querySelector(selector);
  const mkj$$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /*
   * 评估题库。
   * 每道题对应一个能力维度，每个选项带 1-4 分。提交顺序、得分方式与结果
   * 展示都由这份结构化数据驱动，后续替换真实题库时只需替换数组内容。
   */
  const mkjQuestions = [
    { dimension:"专业技能", prompt:"面对一个你没做过的技术任务，你通常会先做什么？", helper:"想象你明天就要开始这项任务。", options:[["先拆解需求，找出关键技术点",4],["先找一个相似案例照着做",3],["等别人给出更明确的指引",2],["先放一放，等有时间再处理",1]] },
    { dimension:"沟通表达", prompt:"面试官追问项目细节时，你会怎样回答？", helper:"重点是你如何让对方听懂你的判断。", options:[["先给结论，再用过程和结果证明",4],["按照项目时间线完整讲一遍",3],["只回答对方刚刚问的那一句",2],["紧张时容易偏离问题",1]] },
    { dimension:"逻辑思维", prompt:"当你需要在多个方案中做选择，你最看重什么？", helper:"选择你实际做决策时最接近的一项。", options:[["目标、约束和可验证的结果",4],["团队多数人的意见",3],["哪一个方案看起来更快",2],["凭当下直觉决定",1]] },
    { dimension:"抗压能力", prompt:"连续被拒绝或被指出问题后，你会怎么调整？", helper:"没有标准答案，关注你的恢复方式。", options:[["记录反馈，调整策略后继续尝试",4],["休息一下，再找熟悉的人聊聊",3],["先把注意力转到别的事情上",2],["很久都不想再面对相似场景",1]] },
    { dimension:"学习能力", prompt:"你最近一次主动学习，通常是因为什么开始的？", helper:"从真实发生过的经历里选择。", options:[["遇到问题，主动追根究底",4],["看到行业变化，提前做准备",3],["身边的人推荐了一个课程",2],["临近考试或面试才开始",1]] },
    { dimension:"职业规划", prompt:"如果现在要确定一个目标岗位，你会怎么做？", helper:"目标不需要一步到位，但需要可以验证。", options:[["结合兴趣、能力和岗位要求设定",4],["先看身边同学都在投什么",3],["先选一个大方向再说",2],["暂时没有明确的目标岗位",1]] },
    { dimension:"专业技能", prompt:"你会如何证明自己真的掌握了一项技能？", helper:"想想简历上最有说服力的证据。", options:[["用真实项目和可量化结果说明",4],["展示课程作业或练习作品",3],["告诉别人我学过相关内容",2],["等工作中自然获得证明",1]] },
    { dimension:"沟通表达", prompt:"团队意见不一致时，你会优先做什么？", helper:"选择最像你的处理动作。", options:[["先复述彼此目标，再讨论分歧",4],["把各自观点整理出来对比",3],["请负责人直接拍板",2],["尽量避免继续讨论",1]] },
    { dimension:"逻辑思维", prompt:"拿到一个模糊的任务，你判断完成标准的方式是？", helper:"任务越模糊，越需要先定义边界。", options:[["主动确认目标、边界和验收方式",4],["先做一版，再根据反馈修改",3],["参考以前类似任务的标准",2],["等任务变得明确后再开始",1]] },
    { dimension:"抗压能力", prompt:"在截止时间临近但事情还没完成时，你会怎么做？", helper:"选择你通常真正会执行的做法。", options:[["重新排序，先交付最关键的部分",4],["延长时间，尽量把所有细节做完",3],["请别人帮忙一起推进",2],["容易因为焦虑而停滞",1]] }
  ];
  const mkjDimensions = ["专业技能","沟通表达","逻辑思维","抗压能力","学习能力","职业规划"];
  const mkjSuggestionMap = {
    "专业技能":["做一个能被展示的真实项目","把技能写成可验证的项目证据","完成一次岗位技术题复盘"],
    "沟通表达":["练习 90 秒项目复述","用 STAR 结构改写一段经历","做一次模拟面试并录音复盘"],
    "逻辑思维":["把任务拆成目标、约束和结果","训练结构化表达与方案对比","每周完成一次案例分析"],
    "抗压能力":["建立面试反馈记录表","为高压场景准备备用策略","练习把大目标拆成小交付"],
    "学习能力":["建立一份问题驱动的学习清单","用输出检验输入质量","每周固定一次知识复盘"],
    "职业规划":["访谈 2 位目标岗位从业者","对照 JD 做能力差距表","写下未来 30 天验证计划"]
  };
  const mkjTestimonials = [
    ["林晓雨","产品实习生","字节跳动","我终于知道简历一直改不好，问题不是排版，而是没有把结果讲清楚。","林"],
    ["周子扬","前端工程师","小红书","测完以后我没有立刻去学更多，而是先补了一个真正能展示的项目。","周"],
    ["陈思远","市场管培生","安永","报告给的建议很具体，第一次觉得职业规划不是一句口号。","陈"],
    ["赵一鸣","数据分析师","美团","它把我的焦虑拆成了几个可以完成的小动作，投递节奏明显稳了。","赵"],
    ["苏婉宁","运营专员","腾讯","三分钟很短，但结果比我想象得更像自己，也更容易开始改变。","苏"]
  ];
  const mkjFaqs = [
    ["评估是否收费？","基础评估完全免费，完成后可以直接查看能力雷达与三条提升建议。限时福利资料包也免费领取。"],
    ["结果准确吗？","评估反映的是你当下对典型求职场景的反应倾向，不是绝对标签。建议把结果和真实项目、面试反馈放在一起参考。"],
    ["多久能拿到报告？","完成最后一道题后，报告会在当前页面即时生成，不需要等待或跳转。"],
    ["可以重复评估吗？","可以。建议间隔 2-4 周再次评估，用来观察行动计划是否带来了变化。"],
    ["评估结果会保存吗？","默认仅在当前浏览器会话中使用，不要求注册。留资领取资料包时，我们只会使用你填写的姓名和邮箱发送资料。"],
    ["我对结果有疑问怎么办？","可以通过页面右下角客服入口联系我们，我们会帮助你理解各个维度的含义。"]
  ];

  let mkjCurrent = 0;
  let mkjAnswers = [];
  let mkjScores = {};
  let mkjCarouselIndex = 0;
  let mkjCarouselTimer;
  let mkjCurrentUser = null;
  let mkjResendCooldownTimer = null;
  let mkjActiveModal = null;
  let mkjModalTrigger = null;
  let mkjInertedElements = [];
  const mkjProgressStorageKey = "mkj-assessment-progress-v1";
  const mkjSupabaseConfig = window.MKJApp?.config || window.SUPABASE_CONFIG || {};
  const mkjAuthRedirectUrl = new URL("./", window.location.href).href;
  const mkjCanUseSupabase = Boolean(window.MKJApp?.client || (mkjSupabaseConfig.url && mkjSupabaseConfig.publishableKey && window.supabase?.createClient));
  const mkjSupabaseClient = window.MKJApp?.client || (mkjCanUseSupabase ? window.supabase.createClient(mkjSupabaseConfig.url, mkjSupabaseConfig.publishableKey, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  }) : null);

  const mkjFocusableSelector = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
  function mkjOpenModal(target,trigger=document.activeElement){
    const backdrop=typeof target==="string"?mkj$(target):target;
    if(!backdrop)return;
    mkjModalTrigger=trigger instanceof HTMLElement?trigger:document.activeElement;
    backdrop.hidden=false;
    mkjActiveModal=backdrop;
    document.body.classList.add("mkj-modal-open");
    mkjInertedElements=[...document.body.children].filter(element=>element!==backdrop&&!element.matches("script,.mkj-toast"));
    mkjInertedElements.forEach(element=>{if(!element.inert){element.inert=true;element.dataset.mkjManagedInert="true"}});
    const dialog=mkj$("[role='dialog']",backdrop);
    const titleId=dialog?.getAttribute("aria-labelledby");
    const title=titleId?document.getElementById(titleId):null;
    if(title){title.tabIndex=-1;title.focus({preventScroll:true})}
    else mkj$(mkjFocusableSelector,dialog)?.focus({preventScroll:true});
  }
  function mkjCloseModal(target=mkjActiveModal,restoreFocus=true){
    const backdrop=typeof target==="string"?mkj$(target):target;
    if(!backdrop)return;
    backdrop.hidden=true;
    if(backdrop===mkjActiveModal){
      mkjActiveModal=null;
      document.body.classList.remove("mkj-modal-open");
      mkjInertedElements.forEach(element=>{if(element.dataset.mkjManagedInert){element.inert=false;delete element.dataset.mkjManagedInert}});
      mkjInertedElements=[];
      if(restoreFocus&&mkjModalTrigger?.isConnected){
        const fallback=mkjModalTrigger.getClientRects().length?mkjModalTrigger:mkj$("#mkj-menu-button");
        fallback?.focus({preventScroll:true});
      }
      mkjModalTrigger=null;
    }
  }

  function mkjInit(){
    mkjSetupEnhanced();

    mkjSetupNavigation();
    mkjSetupReveal();
    mkjSetupCounters();
    mkjSetupAssessment();
    mkjSetupTestimonials();
    mkjSetupFaq();
    mkjSetupSupport();
    mkjSetupChangelog();
    mkjSetupAuth();
    mkjSetupModals();
    mkjSetupBackTop();
    mkjTypewriter();
  }

  function mkjSetupNavigation(){
    const header = mkj$("#mkj-header");
    const menuButton = mkj$("#mkj-menu-button");
    const nav = mkj$("#mkj-nav");
    const updateHeader = () => header.classList.toggle("mkj-is-scrolled", window.scrollY > 12);
    window.addEventListener("scroll", updateHeader, {passive:true});
    updateHeader();
    const overlay=document.createElement("button");
    overlay.type="button";overlay.className="mkj-nav-overlay";overlay.setAttribute("aria-label","关闭导航菜单");overlay.hidden=true;document.body.appendChild(overlay);
    const closeNav=(restoreFocus=false)=>{nav.classList.remove("mkj-is-open");menuButton.setAttribute("aria-expanded","false");overlay.hidden=true;document.body.classList.remove("mkj-nav-open");if(restoreFocus)menuButton.focus({preventScroll:true})};
    const openNav=()=>{nav.classList.add("mkj-is-open");menuButton.setAttribute("aria-expanded","true");overlay.hidden=false;document.body.classList.add("mkj-nav-open")};
    menuButton.addEventListener("click", () => nav.classList.contains("mkj-is-open")?closeNav(true):openNav());
    overlay.addEventListener("click",()=>closeNav(true));
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&nav.classList.contains("mkj-is-open")){event.preventDefault();closeNav(true)}});
    window.addEventListener("resize",()=>{if(window.innerWidth>780&&nav.classList.contains("mkj-is-open"))closeNav(false)});
    mkj$$(".mkj-nav-link, .mkj-main-site-button, .mkj-log-button, .mkj-account-button").forEach(link => link.addEventListener("click", () => closeNav(false)));
    const sections = mkj$$("main section[id]");
    const links = mkj$$(".mkj-nav-link");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if(entry.isIntersecting){
        links.forEach(link => link.classList.toggle("mkj-is-active", link.getAttribute("href") === "#"+entry.target.id));
      }
    }), {rootMargin:"-35% 0px -55% 0px"});
    sections.forEach(section => observer.observe(section));
  }

  function mkjSetupReveal(){
    const items = mkj$$(".mkj-reveal");
    if(!("IntersectionObserver" in window)){ items.forEach(item => item.classList.add("mkj-is-visible")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add("mkj-is-visible"); observer.unobserve(entry.target); }
    }), {threshold:.12});
    items.forEach(item => observer.observe(item));
  }

  function mkjSetupCounters(){
    const counters = mkj$$(".mkj-counter");
    const animateCounter = element => {
      const target = Number(element.dataset.count || 0);
      const start = performance.now();
      const duration = 1300;
      const tick = now => {
        const progress = Math.min((now-start)/duration,1);
        const eased = 1-Math.pow(1-progress,3);
        element.textContent = Math.round(target*eased).toLocaleString("zh-CN");
        if(progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if(!("IntersectionObserver" in window)){ counters.forEach(animateCounter); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if(entry.isIntersecting){ animateCounter(entry.target); observer.unobserve(entry.target); }
    }), {threshold:.4});
    counters.forEach(counter => observer.observe(counter));
  }

  /* 渲染当前题目，选项点击后保留选择态，再自动进入下一题。 */
  function mkjSetupAssessment(){
    mkj$("#mkj-total-step").textContent = mkjQuestions.length;
    mkjLoadAssessmentProgress();
    mkjRenderQuestion();
    mkj$("#mkj-prev-button").addEventListener("click", () => {
      if(mkjCurrent > 0){ mkjCurrent -= 1; mkjPersistAssessmentProgress(); mkjRenderQuestion(); }
    });
    mkj$("#mkj-save-progress").addEventListener("click", () => {
      mkjPersistAssessmentProgress();
      mkjShowToast("评估进度已保存");
    });
    mkj$("#mkj-restart-button").addEventListener("click", () => {
      mkjCurrent=0; mkjAnswers=[]; mkjScores={}; localStorage.removeItem(mkjProgressStorageKey); mkj$("#mkj-report").hidden=true; mkj$("#mkj-assessment-shell").hidden=false; mkjRenderQuestion();
    });
    document.addEventListener("keydown", event => {
      if(["1","2","3","4"].includes(event.key) && !mkj$("#mkj-assessment-shell").hidden) mkjSelectOption(Number(event.key)-1);
    });
  }
  function mkjLoadAssessmentProgress(){
    try{
      const saved=JSON.parse(localStorage.getItem(mkjProgressStorageKey)||"null");
      if(!saved||!Array.isArray(saved.answers)||!Number.isInteger(saved.current))return;
      if(saved.current<0||saved.current>=mkjQuestions.length)return;
      mkjCurrent=saved.current;
      mkjAnswers=saved.answers.slice(0,mkjQuestions.length);
    }catch(error){ localStorage.removeItem(mkjProgressStorageKey); }
  }
  function mkjPersistAssessmentProgress(){
    localStorage.setItem(mkjProgressStorageKey,JSON.stringify({current:mkjCurrent,answers:mkjAnswers}));
  }
  function mkjRenderQuestion(){
    const question = mkjQuestions[mkjCurrent];
    mkj$("#mkj-current-step").textContent = mkjCurrent + 1;
    mkj$("#mkj-question-label").textContent = `QUESTION ${String(mkjCurrent+1).padStart(2,"0")}`;
    const progressTrack = mkj$(".mkj-progress-track");
    const progressValue = mkjCurrent + 1;
    progressTrack.setAttribute("role","progressbar");
    progressTrack.setAttribute("aria-valuemin","0");
    progressTrack.setAttribute("aria-valuemax",String(mkjQuestions.length));
    progressTrack.setAttribute("aria-valuenow",String(progressValue));
    progressTrack.setAttribute("aria-valuetext",`第 ${progressValue} 题，共 ${mkjQuestions.length} 题`);
    mkj$("#mkj-progress-bar").style.transform = `scaleX(${progressValue/mkjQuestions.length})`;
    mkj$("#mkj-question-dimension").textContent = question.dimension;
    mkj$("#mkj-question-title").textContent = question.prompt;
    mkj$("#mkj-question-helper").textContent = question.helper;
    const options = mkj$("#mkj-options");
    options.setAttribute("aria-busy","false");
    options.innerHTML = "";
    question.options.forEach((option,index) => {
      const button = document.createElement("button");
      const selected = mkjAnswers[mkjCurrent] === index;
      button.className = "mkj-option" + (selected ? " mkj-is-selected" : "");
      button.type = "button";
      button.setAttribute("aria-pressed",String(selected));
      button.innerHTML = `<span class="mkj-option-index">${index+1}</span><span class="mkj-option-label">${option[0]}</span><span class="mkj-option-check">✓</span>`;
      button.addEventListener("click", () => mkjSelectOption(index));
      options.appendChild(button);
    });
    mkj$("#mkj-prev-button").disabled = mkjCurrent === 0;
  }
  function mkjSelectOption(index){
    const question = mkjQuestions[mkjCurrent];
    if(!question.options[index]) return;
    const options = mkj$("#mkj-options");
    if(options.getAttribute("aria-busy")==="true") return;
    options.setAttribute("aria-busy","true");
    mkjAnswers[mkjCurrent] = index;
    mkj$$(".mkj-option").forEach((button,i) => {
      const selected = i === index;
      button.classList.toggle("mkj-is-selected",selected);
      button.setAttribute("aria-pressed",String(selected));
      button.disabled = true;
    });
    mkj$("#mkj-prev-button").disabled = true;
    window.setTimeout(() => {
      if(mkjCurrent < mkjQuestions.length-1){ mkjCurrent += 1; mkjPersistAssessmentProgress(); mkjRenderQuestion(); }
      else mkjFinishAssessment();
    }, 360);
  }
  function mkjFinishAssessment(){
    localStorage.removeItem(mkjProgressStorageKey);
    mkjScores = Object.fromEntries(mkjDimensions.map(dimension => [dimension,[]]));
    mkjQuestions.forEach((question,index) => mkjScores[question.dimension].push(question.options[mkjAnswers[index]][1]));
    const dimensionScores = Object.fromEntries(mkjDimensions.map(dimension => {
      const values = mkjScores[dimension];
      return [dimension, Math.round((values.reduce((a,b)=>a+b,0)/(values.length*4))*100)];
    }));
    const total = Math.round(Object.values(dimensionScores).reduce((a,b)=>a+b,0)/mkjDimensions.length);
    mkj$("#mkj-assessment-shell").hidden=true;
    mkj$("#mkj-report").hidden=false;
    mkj$("#mkj-report").setAttribute("aria-busy","true");
    mkjRenderReport(dimensionScores,total);
    mkj$("#mkj-report").setAttribute("aria-busy","false");
    mkj$("#mkj-report").scrollIntoView({behavior:"smooth",block:"start"});
    window.setTimeout(() => mkjOpenModal("#mkj-benefit-modal"), 650);
  }
  function mkjRenderReport(scores,total){
    const sorted = [...mkjDimensions].sort((a,b)=>scores[b]-scores[a]);
    const level = total >= 85 ? "黄金" : total >= 65 ? "白银" : "青铜";
    mkj$("#mkj-report-score").textContent = total;
    mkj$("#mkj-report-level").textContent = level;
    mkj$("#mkj-strongest").textContent = sorted[0];
    mkj$("#mkj-weakest").textContent = sorted[sorted.length-1];
    mkj$("#mkj-report-summary").textContent = total >= 80 ? "基础扎实，适合进入高质量投递节奏。" : total >= 60 ? "已有可投递基础，补齐关键证据会更稳。" : "先建立稳定的行动节奏，再逐步扩大目标。";
    const recommendations = mkj$("#mkj-recommendations");
    recommendations.innerHTML = sorted.slice(-3).reverse().map((dimension,index) => `<div class="mkj-recommendation" role="listitem" aria-labelledby="mkj-recommendation-${index+1}-title"><span class="mkj-recommendation-number">0${index+1} / ${dimension}</span><h4 id="mkj-recommendation-${index+1}-title">${mkjSuggestionMap[dimension][0]}</h4><p>把 ${dimension} 从“知道”变成面试时可以讲清楚的证据。</p><a href="#articles">查看推荐文章 →</a></div>`).join("");
    mkjDrawRadar(scores);
  }

  /* Canvas 雷达图使用与页面同色系的轻量线面，按结果从 0 动画到当前能力。 */
  function mkjDrawRadar(scores){
    const canvas = mkj$("#mkj-radar-canvas");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, rect.width * ratio);
    canvas.height = Math.max(260, rect.width * .82 * ratio);
    const w = canvas.width, h = canvas.height, centerX=w/2, centerY=h/2+8*ratio, radius=Math.min(w,h)*.34;
    const draw = progress => {
      ctx.clearRect(0,0,w,h);
      const point = (value, offset=0) => {
        const angle = (-Math.PI/2) + (Math.PI*2/mkjDimensions.length)*offset;
        return [centerX+Math.cos(angle)*radius*value/100,centerY+Math.sin(angle)*radius*value/100];
      };
      for(let ring=1;ring<=4;ring++){
        ctx.beginPath();
        mkjDimensions.forEach((_,i)=>{ const p=point(ring*25,i); i?ctx.lineTo(...p):ctx.moveTo(...p); });
        ctx.closePath(); ctx.strokeStyle="#e7edf4"; ctx.lineWidth=ratio; ctx.stroke();
      }
      mkjDimensions.forEach((dimension,i)=>{ const p=point(100,i); ctx.beginPath();ctx.moveTo(centerX,centerY);ctx.lineTo(...p);ctx.strokeStyle="#edf1f5";ctx.stroke();ctx.fillStyle="#667384";ctx.font=`${11*ratio}px -apple-system, BlinkMacSystemFont, sans-serif`;const labelP=point(120,i);ctx.textAlign=labelP[0]<centerX-4*ratio?"right":labelP[0]>centerX+4*ratio?"left":"center";ctx.fillText(dimension,labelP[0],labelP[1]);});
      ctx.beginPath(); mkjDimensions.forEach((dimension,i)=>{const p=point(60,i);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.fillStyle="rgba(180,190,202,.13)";ctx.fill();ctx.strokeStyle="#bec8d3";ctx.stroke();
      ctx.beginPath(); mkjDimensions.forEach((dimension,i)=>{const p=point(scores[dimension]*progress,i);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.fillStyle="rgba(43,110,240,.18)";ctx.fill();ctx.strokeStyle="#2b6ef0";ctx.lineWidth=2*ratio;ctx.stroke();
      mkjDimensions.forEach((dimension,i)=>{const p=point(scores[dimension]*progress,i);ctx.beginPath();ctx.arc(p[0],p[1],4*ratio,0,Math.PI*2);ctx.fillStyle="#2b6ef0";ctx.fill()});
    };
    const start=performance.now(); const tick=now=>{const progress=Math.min((now-start)/900,1);draw(1-Math.pow(1-progress,3));if(progress<1)requestAnimationFrame(tick)}; requestAnimationFrame(tick);
  }
  window.addEventListener("resize",()=>{if(!mkj$("#mkj-report").hidden && Object.keys(mkjScores).length) mkjDrawRadar(Object.fromEntries(mkjDimensions.map(d=>[d,Math.round((mkjScores[d].reduce((a,b)=>a+b,0)/(mkjScores[d].length*4))*100)])))});

  function mkjSetupTestimonials(){
    const track=mkj$("#mkj-testimonial-track"), dots=mkj$("#mkj-carousel-dots");
    track.innerHTML=mkjTestimonials.map(item=>`<article class="mkj-testimonial"><div class="mkj-testimonial-top"><div class="mkj-testimonial-avatar">${item[4]}</div><div><h3>${item[0]}</h3><p>${item[1]} · ${item[2]}</p></div><span class="mkj-stars">★★★★★</span></div><blockquote>“${item[3]}”</blockquote><cite>已完成 MKJ 竞争力校准</cite></article>`).join("");
    const getPageCount=()=>{const visible=window.innerWidth<=780?1:window.innerWidth<=900?2:3;return Math.max(1,mkjTestimonials.length-visible+1)};
    const renderDots=()=>{const pages=getPageCount();dots.innerHTML=Array.from({length:pages},(_,i)=>`<button type="button" aria-label="查看第 ${i+1} 页评价" aria-current="${i===mkjCarouselIndex?"true":"false"}" class="${i===mkjCarouselIndex?"mkj-is-active":""}"></button>`).join("");mkj$$("button",dots).forEach((dot,i)=>dot.addEventListener("click",()=>{mkjCarouselIndex=i;render()}))};
    const render=()=>{const cardWidth=mkj$(".mkj-testimonial").getBoundingClientRect().width+18;const max=getPageCount()-1;mkjCarouselIndex=Math.min(mkjCarouselIndex,max);track.style.transform=`translateX(-${mkjCarouselIndex*cardWidth}px)`;mkj$$("button",dots).forEach((dot,i)=>{const active=i===mkjCarouselIndex;dot.classList.toggle("mkj-is-active",active);dot.setAttribute("aria-current",String(active))})};
    renderDots();
    const next=()=>{const max=getPageCount()-1;mkjCarouselIndex=mkjCarouselIndex>=max?0:mkjCarouselIndex+1;render()};
    mkj$("#mkj-carousel-prev").addEventListener("click",()=>{mkjCarouselIndex=Math.max(0,mkjCarouselIndex-1);render()});
    mkj$("#mkj-carousel-next").addEventListener("click",next);
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopAuto=()=>{window.clearInterval(mkjCarouselTimer);mkjCarouselTimer=null};
    const startAuto=()=>{if(!reducedMotion.matches&&!mkjCarouselTimer)mkjCarouselTimer=window.setInterval(next,3000)};
    startAuto(); window.addEventListener("resize",render);
    const viewport=mkj$(".mkj-carousel-viewport");viewport.tabIndex=0;viewport.setAttribute("aria-label","用户评价轮播");let startX=0;
    viewport.addEventListener("mouseenter",stopAuto);viewport.addEventListener("mouseleave",startAuto);viewport.addEventListener("focusin",stopAuto);viewport.addEventListener("focusout",startAuto);
    reducedMotion.addEventListener?.("change",()=>{stopAuto();startAuto()});
    document.addEventListener("visibilitychange",()=>document.hidden?stopAuto():startAuto());
    viewport.addEventListener("touchstart",e=>{startX=e.changedTouches[0].screenX},{passive:true});
    viewport.addEventListener("touchend",e=>{const delta=e.changedTouches[0].screenX-startX;if(Math.abs(delta)>40)delta<0?next():(mkjCarouselIndex=Math.max(0,mkjCarouselIndex-1),render())},{passive:true});
  }
  function mkjSetupFaq(){
    mkj$("#mkj-faq-list").innerHTML=mkjFaqs.map((item,index)=>`<div class="mkj-faq-item ${index===0?"mkj-is-open":""}"><button class="mkj-faq-question" type="button" aria-expanded="${index===0}"><span>${item[0]}</span><span>+</span></button><div class="mkj-faq-answer"><p>${item[1]}</p></div></div>`).join("");
    mkj$$(".mkj-faq-question").forEach(button=>button.addEventListener("click",()=>{const item=button.parentElement;const open=item.classList.toggle("mkj-is-open");button.setAttribute("aria-expanded",String(open))}));
  }
  function mkjSetupSupport(){
    const button=mkj$("#mkj-support-button"),menu=mkj$("#mkj-support-menu");
    const close=(restoreFocus=false)=>{menu.hidden=true;button.classList.remove("mkj-is-open");button.setAttribute("aria-expanded","false");if(restoreFocus)button.focus({preventScroll:true})};
    button.addEventListener("click",()=>{const open=menu.hidden;if(open){menu.hidden=false;button.classList.add("mkj-is-open");button.setAttribute("aria-expanded","true")}else close(true)});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!menu.hidden){event.preventDefault();close(true)}});
    document.addEventListener("click",event=>{if(!menu.hidden&&!menu.contains(event.target)&&event.target!==button)close(false)});
  }
  function mkjSetupChangelog(){
    mkj$("#mkj-log-button").addEventListener("click",event=>mkjOpenModal("#mkj-changelog-modal",event.currentTarget));
  }
  /* 认证逻辑沿用原航线账户能力：Supabase 会话、登录、注册、验证邮件、找回密码与退出。 */
  function mkjSetupAuth(){
    const accountButton=mkj$("#mkj-account-button");
    const authModal=mkj$("#mkj-auth-modal");
    const authTabs=mkj$$("[data-mkj-auth-view]");
    const authForms=mkj$$("[data-mkj-auth-form]");
    const authHint=mkj$("#mkj-auth-hint");
    const authMessage=mkj$("#mkj-auth-message");
    const sessionBox=mkj$("#mkj-auth-session");
    const authTabsBox=mkj$("#mkj-auth-tabs");
    const authTitle=mkj$("#mkj-auth-title");
    const authCopy=mkj$("#mkj-auth-copy");
    const resendButton=mkj$("#mkj-resend-confirmation");
    const redeemPanel=mkj$("#mkj-redeem-panel");
    const redeemForm=mkj$("#mkj-redeem-form");
    const redeemMessage=mkj$("#mkj-redeem-message");
    const reputationValue=mkj$("#mkj-reputation-value");
    const reputationMeta=mkj$("#mkj-reputation-meta");

    const setMessage=(message="",tone="error")=>{
      authMessage.textContent=message;authMessage.dataset.tone=tone;authMessage.hidden=!message;authMessage.setAttribute("role",tone==="error"?"alert":"status");
    };
    const setRedeemMessage=(message="",tone="error")=>{
      redeemMessage.textContent=message;redeemMessage.dataset.tone=tone;redeemMessage.hidden=!message;redeemMessage.setAttribute("role",tone==="error"?"alert":"status");
    };
    const setBusy=(form,busy)=>{
      form.setAttribute("aria-busy",String(busy));
      mkj$$("input,button",form).forEach(control=>{if(control===resendButton&&mkjResendCooldownTimer)return;control.disabled=busy});
      const submit=mkj$("button[type='submit']",form);
      if(submit?.dataset.mkjIdleLabel)submit.textContent=busy?submit.dataset.mkjBusyLabel:submit.dataset.mkjIdleLabel;
    };
    const setView=view=>{
      const recovery=view==="update";
      authTabs.forEach(tab=>{const active=tab.dataset.mkjAuthView===view;tab.classList.toggle("mkj-is-active",active);tab.setAttribute("aria-selected",String(active))});
      authForms.forEach(form=>{form.hidden=(mkjCurrentUser&&!recovery)||form.dataset.mkjAuthForm!==view});
      authTabsBox.hidden=recovery||Boolean(mkjCurrentUser);
      redeemPanel.hidden=recovery;
      authTitle.textContent=recovery?"为账户设置新密码。":mkjCurrentUser?"你的航线账户已连接。":"把你的进度，带到每一次打开。";
      authCopy.textContent=recovery?"恢复链接已验证。保存后即可使用新密码登录。":mkjCurrentUser?"你的评估与行动记录会继续保存在这个账户中。":"注册后，评估记录与个性化建议会安全保存在你的账户。";
      setMessage("");
    };
    const openAuth=view=>{setView(view);authHint.textContent=mkjCanUseSupabase?"你的账户数据将通过 Supabase 安全保存。":"账户服务暂未连接，请检查 /MKJ/supabase-config.js。";mkjOpenModal(authModal,accountButton)};
    const formatError=(error,fallback)=>{
      const raw=[error?.message,error?.error_description,error?.msg,error?.error,error?.cause?.message].find(value=>typeof value==="string"&&value.trim()&&value.trim()!=="{}")||"";
      if(/invalid login credentials/i.test(raw))return"邮箱或密码不正确";
      if(/email not confirmed/i.test(raw))return"邮箱还未验证，请先查收验证邮件";
      if(/user already registered/i.test(raw))return"这个邮箱已经注册过了，请直接登录";
      if(/rate limit|too many requests|over_email_send_rate_limit/i.test(raw))return"邮件发送过于频繁，请稍后再试";
      if(/smtp|535|authentication failed|username and password not accepted/i.test(raw))return"发件邮箱认证失败，请检查 SMTP 配置";
      if(/error sending|failed to send|confirmation email|recovery email/i.test(raw))return"邮件发送失败，请检查 SMTP 配置或稍后再试";
      if(/failed to fetch|network|load failed/i.test(raw))return"网络连接失败，请检查网络后重试";
      return raw||fallback;
    };
    const startCooldown=()=>{
      window.clearInterval(mkjResendCooldownTimer);let remaining=60;resendButton.disabled=true;resendButton.textContent=`${remaining} 秒后可重新发送`;
      mkjResendCooldownTimer=window.setInterval(()=>{remaining-=1;if(remaining>0)resendButton.textContent=`${remaining} 秒后可重新发送`;else{window.clearInterval(mkjResendCooldownTimer);mkjResendCooldownTimer=null;resendButton.disabled=false;resendButton.textContent="重新发送验证邮件"}},1000);
    };
    const loadReputation=async user=>{
      if(!user||!mkjSupabaseClient){reputationValue.textContent="--";reputationMeta.textContent="\u767b\u5f55\u540e\u67e5\u770b\u5f53\u524d\u7b49\u7ea7\u4e0e\u4e0b\u4e00\u9636\u6bb5\u3002";return}
      reputationValue.textContent="...";reputationMeta.textContent="\u6b63\u5728\u8bfb\u53d6\u4f60\u7684\u5168\u5c40\u58f0\u671b\u3002";
      try{const{data,error}=await mkjSupabaseClient.from("user_public_profiles").select("reputation, role").eq("user_id",user.id).maybeSingle();if(error)throw error;if(mkjCurrentUser?.id!==user.id)return;const reputation=Math.max(0,Math.floor(Number(data?.reputation)||0));const level=reputation>=50000?"\u58f0\u671b\u4e4b\u795e":reputation>=25000?"\u81f3\u5c0a\u4f1a\u5458":reputation>=10000?"\u8bba\u575b\u5143\u8001":reputation>=4000?"\u91d1\u724c\u4f1a\u5458":reputation>=1500?"\u9ad8\u7ea7\u4f1a\u5458":reputation>=500?"\u4e2d\u7ea7\u4f1a\u5458":reputation>=100?"\u521d\u7ea7\u4f1a\u5458":reputation>=10?"\u65b0\u624b\u4e0a\u8def":"\u6e38\u5ba2";reputationValue.textContent=`${reputation.toLocaleString("zh-CN")} \u58f0\u671b`;reputationMeta.textContent=`\u5f53\u524d\u7b49\u7ea7\uff1a${data?.role==="ADMIN"?"\u7ba1\u7406\u5458":data?.role==="MODERATOR"?"\u7248\u4e3b":level}`;const displayName=user.user_metadata?.display_name||user.email?.split("@")[0]||"\u822a\u7ebf\u540c\u5b66";accountButton.textContent=`${displayName} \u00b7 ${reputation}`;}catch(error){if(mkjCurrentUser?.id!==user.id)return;reputationValue.textContent="--";reputationMeta.textContent="\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u58f0\u671b\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002";}
    };
    const updateUI=user=>{
      mkjCurrentUser=user||null;
      redeemPanel.hidden=false;
      if(!user){accountButton.textContent="登录 / 注册";sessionBox.hidden=true;authTabsBox.hidden=false;void loadReputation(null);return}
      const email=user.email||"";const displayName=user.user_metadata?.display_name||email.split("@")[0]||"航线同学";
      accountButton.textContent=displayName;mkj$("#mkj-auth-session-avatar").textContent=displayName.slice(0,1);mkj$("#mkj-auth-session-name").textContent=displayName;mkj$("#mkj-auth-session-email").textContent=email;sessionBox.hidden=false;void loadReputation(user);
    };
    const requireClient=()=>{if(!mkjSupabaseClient){setMessage("账户服务暂未连接，请检查 /MKJ/supabase-config.js。");return false}return true};
    accountButton.addEventListener("click",()=>openAuth(mkjCurrentUser?"login":"login"));
    authTabs.forEach(tab=>tab.addEventListener("click",()=>setView(tab.dataset.mkjAuthView)));
    mkj$("#mkj-auth-logout").addEventListener("click",async()=>{if(!requireClient())return;const{error}=await mkjSupabaseClient.auth.signOut();if(error){setMessage(formatError(error,"退出登录失败"));return}mkjCloseModal(authModal);updateUI(null);mkjShowToast("已退出登录")});
    redeemForm.addEventListener("input",()=>setRedeemMessage(""));
    redeemForm.addEventListener("submit",async event=>{
      event.preventDefault();if(!requireClient())return;if(!mkjCurrentUser){setRedeemMessage("\u8bf7\u5148\u767b\u5f55\u8d26\u6237\u540e\u518d\u5151\u6362\u793c\u5305\u7801\u3002");return}const form=event.currentTarget,data=new FormData(form);setRedeemMessage("");setBusy(form,true);
      try{const result=await redeemCode(mkjSupabaseClient,data.get("code"));const reputation=Number(result?.reward?.reputation);const amount=Number.isFinite(reputation)?reputation.toLocaleString("zh-CN"):"";form.reset();setRedeemMessage(amount?`\u5151\u6362\u6210\u529f\uff0c\u5f53\u524d\u5168\u5c40\u58f0\u671b\u4e3a ${amount}\u3002`:`\u5151\u6362\u6210\u529f\uff0c\u5956\u52b1\u5df2\u8bb0\u5165\u5168\u5c40\u58f0\u671b\u3002`,"success");void loadReputation(mkjCurrentUser);mkjShowToast("\u793c\u5305\u7801\u5151\u6362\u6210\u529f")}catch(error){setRedeemMessage(formatError(error,"\u793c\u5305\u7801\u65e0\u6548\u3001\u5df2\u4f7f\u7528\u3001\u5df2\u8fc7\u671f\u6216\u6682\u4e0d\u53ef\u7528"),"error")}finally{setBusy(form,false)}
    });
    mkj$("#mkj-login-form").addEventListener("submit",async event=>{
      event.preventDefault();if(!requireClient())return;const form=event.currentTarget,data=new FormData(form);setMessage("");setBusy(form,true);
      try{const{error}=await mkjSupabaseClient.auth.signInWithPassword({email:String(data.get("email")).trim(),password:String(data.get("password"))});if(error){setMessage(formatError(error,"登录失败，请稍后再试"));return}mkjCloseModal(authModal);mkjShowToast("登录成功，欢迎回到航线")}catch(error){setMessage(formatError(error,"登录失败，请稍后再试"))}finally{setBusy(form,false)}
    });
    mkj$("#mkj-register-form").addEventListener("submit",async event=>{
      event.preventDefault();if(!requireClient())return;const form=event.currentTarget,data=new FormData(form);const displayName=String(data.get("displayName")).trim()||"航线同学";setMessage("");setBusy(form,true);
      try{const{data:result,error}=await mkjSupabaseClient.auth.signUp({email:String(data.get("email")).trim(),password:String(data.get("password")),options:{data:{display_name:displayName},emailRedirectTo:mkjAuthRedirectUrl}});if(error){setMessage(formatError(error,"注册失败，验证邮件未能发送"));return}if(result.session){mkjCloseModal(authModal);mkjShowToast("账户创建成功")}else{setMessage("注册成功，请查收验证邮件后再登录。","success");startCooldown()}}catch(error){setMessage(formatError(error,"注册失败，验证邮件未能发送"))}finally{setBusy(form,false)}
    });
    resendButton.addEventListener("click",async()=>{if(!requireClient())return;const email=String(mkj$("#mkj-register-form [name='email']").value).trim();if(!email){setMessage("请先填写需要验证的邮箱");return}resendButton.disabled=true;setMessage("");try{const{error}=await mkjSupabaseClient.auth.resend({type:"signup",email,options:{emailRedirectTo:mkjAuthRedirectUrl}});if(error)throw error;setMessage("验证邮件已重新发送，请检查收件箱和垃圾邮件。","success");startCooldown()}catch(error){setMessage(formatError(error,"验证邮件发送失败，请稍后再试"));resendButton.disabled=false}});
    mkj$("#mkj-reset-form").addEventListener("submit",async event=>{event.preventDefault();if(!requireClient())return;const form=event.currentTarget,data=new FormData(form);setMessage("");setBusy(form,true);try{const{error}=await mkjSupabaseClient.auth.resetPasswordForEmail(String(data.get("email")).trim(),{redirectTo:mkjAuthRedirectUrl});if(error){setMessage(formatError(error,"重置邮件发送失败"));return}setMessage("重置邮件已发送，请检查邮箱。","success")}catch(error){setMessage(formatError(error,"重置邮件发送失败"))}finally{setBusy(form,false)}});
    mkj$("#mkj-update-password-form").addEventListener("submit",async event=>{event.preventDefault();if(!requireClient())return;const form=event.currentTarget,data=new FormData(form),password=String(data.get("password"));if(password!==String(data.get("passwordConfirm"))){setMessage("两次输入的密码不一致，请重新确认");return}setMessage("");setBusy(form,true);try{const{error}=await mkjSupabaseClient.auth.updateUser({password});if(error){setMessage(formatError(error,"密码更新失败，请重新打开恢复链接"));return}form.reset();mkjCloseModal(authModal);mkjShowToast("密码已更新，可以使用新密码登录")}catch(error){setMessage(formatError(error,"密码更新失败，请重新打开恢复链接"))}finally{setBusy(form,false)}});
    const mkjRecoveryFlow=window.location.hash.includes("type=recovery")||new URLSearchParams(window.location.search).get("type")==="recovery";
    const openAccountRoute=()=>{if(window.location.hash === "#account")openAuth("login")};
    window.addEventListener("hashchange",openAccountRoute);
    if(mkjSupabaseClient){mkjSupabaseClient.auth.onAuthStateChange((event,session)=>window.setTimeout(()=>{updateUI(session?.user||null);if(event==="PASSWORD_RECOVERY"||mkjRecoveryFlow)openAuth("update");else openAccountRoute()},0));mkjSupabaseClient.auth.getSession().then(({data})=>{updateUI(data.session?.user||null);if(mkjRecoveryFlow)openAuth("update");else openAccountRoute()});}
    else updateUI(null);
  }
  /* 增强模块：让新流程卡片与英雄徽章保持轻量动效，同时不改变既有逻辑。 */
  function mkjSetupEnhanced(){
    const badges=mkj$$(".mkj-hero-badges span");
    badges.forEach((badge,index)=>badge.style.transitionDelay=`${index*90}ms`);
    const processCards=mkj$$(".mkj-process-card");
    if(processCards.length){
      processCards.forEach(card=>card.addEventListener("mouseenter",()=>{
        const dot=card.querySelector("span");
        if(dot)dot.style.color="#1a4fdb";
      }));
    }
  }  function mkjShowToast(message){
    let toast=mkj$("#mkj-auth-toast");
    if(!toast){toast=document.createElement("div");toast.id="mkj-auth-toast";toast.className="mkj-toast";toast.hidden=true;document.body.appendChild(toast)}
    toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");toast.textContent=message;toast.hidden=false;requestAnimationFrame(()=>toast.classList.add("mkj-is-visible"));window.clearTimeout(toast._mkjTimer);toast._mkjTimer=window.setTimeout(()=>{toast.classList.remove("mkj-is-visible");window.setTimeout(()=>toast.hidden=true,250)},2600);
  }
  function mkjSetupModals(){
    mkj$$("[data-mkj-close-modal]").forEach(button=>button.addEventListener("click",()=>mkjCloseModal(button.closest(".mkj-modal-backdrop"))));
    mkj$$(".mkj-modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",event=>{if(event.target===backdrop)mkjCloseModal(backdrop)}));
    document.addEventListener("keydown",event=>{
      if(!mkjActiveModal)return;
      if(event.key==="Escape"){event.preventDefault();mkjCloseModal();return}
      if(event.key!=="Tab")return;
      const focusable=mkj$$(mkjFocusableSelector,mkjActiveModal).filter(element=>!element.hidden&&element.getClientRects().length);
      if(!focusable.length){event.preventDefault();return}
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    });
    mkj$("#mkj-benefit-form").addEventListener("submit",event=>{event.preventDefault();const form=event.currentTarget,submit=mkj$("button[type='submit']",form);form.setAttribute("aria-busy","true");submit.disabled=true;mkj$("#mkj-benefit-note").textContent="资料包已登记，稍后会发送到你的邮箱。";form.reset();form.setAttribute("aria-busy","false");submit.disabled=false});
    mkj$("#mkj-card-button").addEventListener("click",event=>{mkjBuildAbilityCard();mkjOpenModal("#mkj-card-modal",event.currentTarget)});
    mkj$("#mkj-download-card").addEventListener("click",()=>{const link=document.createElement("a");link.download="mkj-ability-card.png";link.href=mkj$("#mkj-card-canvas").toDataURL("image/png");link.click()});
  }
  function mkjBuildAbilityCard(){
    const canvas=mkj$("#mkj-card-canvas"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
    ctx.fillStyle="#f4f7fb";ctx.fillRect(0,0,w,h);ctx.fillStyle="#fff";ctx.fillRect(52,52,w-104,h-104);
    ctx.fillStyle="#1a1a1e";ctx.font="700 28px -apple-system, BlinkMacSystemFont, sans-serif";ctx.fillText("航线 / 能力名片",96,126);
    ctx.fillStyle="#8c96a5";ctx.font="14px -apple-system, BlinkMacSystemFont, sans-serif";ctx.fillText("CAREER CALIBRATION · 2026",96,157);
    ctx.fillStyle="#2b6ef0";ctx.font="700 110px -apple-system, BlinkMacSystemFont, sans-serif";ctx.fillText(mkj$("#mkj-report-score").textContent,96,330);
    ctx.fillStyle="#6c757d";ctx.font="16px -apple-system, BlinkMacSystemFont, sans-serif";ctx.fillText("/ 100  OVERALL SCORE",310,324);
    const cx=w/2,cy=660,r=210;ctx.strokeStyle="#e8edf3";ctx.lineWidth=2;
    for(let ring=1;ring<=4;ring++){ctx.beginPath();mkjDimensions.forEach((_,i)=>{const a=-Math.PI/2+i*Math.PI*2/6,p=[cx+Math.cos(a)*r*ring/4,cy+Math.sin(a)*r*ring/4];i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.stroke()}
    ctx.beginPath();mkjDimensions.forEach((dimension,i)=>{const a=-Math.PI/2+i*Math.PI*2/6,values=Array.isArray(mkjScores[dimension])?mkjScores[dimension]:[],val=values.length?Math.round((values.reduce((sum,value)=>sum+value,0)/(values.length*4))*100):0,p=[cx+Math.cos(a)*r*val/100,cy+Math.sin(a)*r*val/100];i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.fillStyle="rgba(43,110,240,.18)";ctx.fill();ctx.strokeStyle="#2b6ef0";ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle="#6c757d";ctx.font="14px -apple-system, BlinkMacSystemFont, sans-serif";ctx.fillText("别猜未来，现在就校准",96,1005);ctx.fillText("mkj-career.com",96,1032);
  }
  function mkjSetupBackTop(){mkj$("#mkj-back-top").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}))}
  function mkjTypewriter(){
    const element=mkj$("#mkj-typewriter"),words=["现在就校准","把短板变行动","让优势被看见"];let index=0,letter=0,deleting=false;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){element.textContent=words[0];return}
    const tick=()=>{const word=words[index];letter+=deleting?-1:1;element.textContent=word.slice(0,letter);let wait=deleting?55:95;if(!deleting&&letter===word.length){wait=1500;deleting=true}if(deleting&&letter===0){deleting=false;index=(index+1)%words.length;wait=350}window.setTimeout(tick,wait)};window.setTimeout(tick,900);
  }
  document.addEventListener("DOMContentLoaded",mkjInit);
})();

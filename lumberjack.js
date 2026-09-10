(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const palette = ['#f9f9ee', '#dce6cf', '#e1e6f4', '#f0e3d9', '#f7f2d4'];
  const notes = ['再大一点', '还是初稿好', '换个颜色', '再来一版', '这里改改'];
  let width = 1000, height = 600, mode = 'ready', score = 0, remaining = 45;
  let side = -1, stack = [], particles = [], stroke = 0, lastTime = 0, lastCut = -Infinity;
  let best = 0;
  try { best = Number(localStorage.getItem('draft-cutter-best')) || 0; } catch (_) { /* Storage is optional. */ }
  $('best').textContent = String(best).padStart(3, '0');
  function sheet(safe = false) {
    return { hazard: safe || Math.random() < .52 ? 0 : Math.random() < .5 ? -1 : 1,
      color: palette[Math.floor(Math.random() * palette.length)], variation: Math.random(),
      note: notes[Math.floor(Math.random() * notes.length)] };
  }
  function seed() { stack = Array.from({ length: 9 }, (_, i) => sheet(i < 2)); }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    height = 600;
    width = Math.max(470, 600 * bounds.width / bounds.height);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
  }
  function path(points, fill, line = '#313b30', lineWidth = 1.5) {
    ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(x1,y1,x2,y2,color='#354234',size=1.5) {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=color;ctx.lineWidth=size;ctx.stroke();
  }
  function ellipse(x,y,rx,ry,fill) { ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill(); }
  function label(text,x,y,size=10,color='#7c8574') {ctx.font=`${size}px Arial, sans-serif`;ctx.fillStyle=color;ctx.fillText(text,x,y);}
  function drawSheet(item,y,index) {
    const x=width/2, half=62, offset=(item.variation-.5)*9;
    ctx.save();ctx.translate(offset,0);
    path([[x-half,y-38],[x+half,y-38],[x+half+11,y-30],[x-half+11,y-30]],item.color);
    path([[x-half+11,y-30],[x+half+11,y-30],[x+half+11,y],[x-half+11,y]],item.color);
    path([[x-half,y-38],[x-half+11,y-30],[x-half+11,y],[x-half,y-8]],'#c8cebd');
    for(let j=0;j<3;j++)line(x-half+15,y-8-j*5,x+half+7,y-8-j*5,'#aab29e',.6);
    if(index%3===0) { label('Untitled_final_'+(score+index+1),x-half+20,y-18,8,'#65705e'); }
    else {ctx.fillStyle=index%2?'#788d72':'#b3bfa5';ctx.fillRect(x-half+22,y-26,24,9);line(x-5,y-22,x+45,y-22,'#87937c',2);}
    if(item.hazard) {
      const s=item.hazard, start=x+s*65,end=x+s*162;
      line(start,y-20,end,y-20,'#747e65',2);
      ctx.fillStyle='#fff1b9';ctx.strokeStyle='#96966c';ctx.lineWidth=1;
      const left=s<0?end:start+15;ctx.fillRect(left,y-43,80,32);ctx.strokeRect(left,y-43,80,32);
      label(item.note,left+8,y-23,10,'#5e6148');
      ellipse(left+39,y-40,2,2,'#7b8d73');
    }
    ctx.restore();
  }
  // 112 units tall, with a 16-unit head: adult proportions at every viewport size.
  function designer(now) {
    const x=width/2+side*111,y=505, action=stroke>0?Math.sin((1-stroke/.24)*Math.PI):0;
    const breath=mode==='playing'&&!reducedMotion?Math.sin(now*2)*.7:0;
    ellipse(x,y+3,27,6,'#a8b39955');
    ctx.save();ctx.translate(x,y+breath);ctx.scale(-side,1);
    path([[-12,-51],[2,-51],[0,-25],[-7,-4],[-15,-4],[-11,-28]],'#323e38');
    path([[0,-51],[13,-51],[12,-29],[19,-4],[10,-4],[1,-27]],'#465348');
    path([[-16,-5],[-7,-5],[-4,0],[-19,0]],'#f9faf2');
    path([[10,-5],[19,-5],[24,-1],[24,1],[9,1]],'#f9faf2');
    path([[-11,-91],[9,-91],[17,-76],[12,-48],[-13,-48],[-18,-77]],'#6c8070');
    path([[-4,-94],[4,-94],[5,-87],[-3,-86]],'#dec4a7');
    ellipse(0,-102,7.5,9,'#dec4a7');
    path([[-8,-101],[-8,-110],[-3,-114],[6,-112],[9,-107],[7,-102],[3,-107],[-3,-105]],'#303a32');
    // Small glasses and a pocket are visible identifiers, without enlarging the head.
    ctx.strokeStyle='#283a32';ctx.lineWidth=1;ctx.strokeRect(0,-104,7,4);line(-4,-103,0,-103);
    ctx.strokeRect(3,-82,6,7);
    line(-13,-82,-19,-63,'#6c8070',10);line(-19,-63,-7,-57,'#dec4a7',6);
    const handX=25+action*8,handY=-69-action*9;
    line(11,-82,20,-69,'#6c8070',10);line(20,-69,handX,handY,'#dec4a7',6);
    ctx.save();ctx.translate(handX,handY);ctx.rotate(-.48+action*1.25);
    path([[-4,12],[4,12],[4,-19],[-4,-19]],'#45665a');
    // Fountain-pen cursor nib: shoulders, circular breather hole and central slit.
    path([[-4,-19],[-12,-32],[0,-59],[12,-32],[4,-19]],'#f4f8ed','#304b3e',2);
    line(0,-57,0,-34,'#304b3e',1.5);ellipse(0,-32,3,3,'#304b3e');
    line(-4,-20,4,-20,'#304b3e',3);ctx.restore();ctx.restore();
  }
  function draw(now) {
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#edf0e4';ctx.fillRect(0,0,width,height);
    // A quiet drafting grid gives the scene depth without competing with the character.
    for(let x=width/2%40;x<width;x+=40)for(let y=105;y<510;y+=40){ctx.fillStyle='#c8d0bd';ctx.fillRect(x,y,1.4,1.4);}
    ellipse(width/2,508,Math.min(width*.43,360),45,'#dfe5d2');
    line(0,517,width,517,'#c9d0be',1);ctx.fillStyle='#e5e9da';ctx.fillRect(0,518,width,82);
    // Offcuts and a wire basket stay clear of the play area.
    const bin=width/2+200;
    path([[bin-19,477],[bin+19,477],[bin+15,514],[bin-14,514]],null,'#a6b299');
    for(let j=-10;j<=10;j+=10)line(bin+j,482,bin+j*.7,510,'#a6b299');
    path([[bin-12,484],[bin-17,467],[bin-2,462],[bin+7,479]],'#f8f8ed','#b4bda7');
    ellipse(width/2,506,88,12,'#a6b09455');
    path([[width/2-75,494],[width/2+79,494],[width/2+88,508],[width/2-69,508]],'#b7c5a5','#869579');
    for(let i=stack.length-1;i>=0;i--)drawSheet(stack[i],490-i*42,i);
    designer(now);
    particles.forEach(p=>{ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.globalAlpha=Math.max(0,p.life);path([[-15,-8],[14,-8],[15,9],[-13,9]],p.color,'#9ca88e',.7);ctx.restore();});
    if(stroke>0) {
      const x=width/2;ctx.save();ctx.globalAlpha=Math.min(1,stroke*8);ctx.strokeStyle='#20977d';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x-85,472);ctx.bezierCurveTo(x-35,411,x+36,508,x+85,449);ctx.stroke();
      line(x-85,472,x-35,411,'#56ac96',1);line(x+85,449,x+36,508,'#56ac96',1);
      [[x-85,472],[x+85,449]].forEach(([px,py])=>{ctx.fillStyle='#fff';ctx.fillRect(px-3,py-3,6,6);ctx.strokeRect(px-3,py-3,6,6);});
      ellipse(x-35,411,2.5,2.5,'#20977d');ellipse(x+36,508,2.5,2.5,'#20977d');ctx.restore();
    }
  }
  function controls() {
    $('left').disabled=$('right').disabled=mode!=='playing';
    $('pause').disabled=!['playing','paused'].includes(mode);
    $('pause').textContent=mode==='paused'?'继续':'暂停';
  }
  function show(title,message,button,tag) {
    $('title').textContent=title;$('message').textContent=message;$('start').textContent=button;$('tag').textContent=tag;
    $('overlay').hidden=false;controls();$('start').focus({preventScroll:true});
  }
  function finish(collision) {
    mode='over';
    if(score>best) {best=score;try{localStorage.setItem('draft-cutter-best',String(best));}catch(_){} }
    $('best').textContent=String(best).padStart(3,'0');
    const message=collision?`撞上修改意见了。这次清理了 ${score} 份，下次换一侧落笔。`:`清理了 ${score} 份废稿，给新灵感腾出位置了。`;
    show(collision?'这版，还得改。':'今天就到这里。',message,'再清理一轮 ↗','本轮完成');$('status').textContent=message;
  }
  function start() {
    if(mode!=='paused') {score=0;remaining=45;side=-1;particles=[];stroke=0;seed();$('score').textContent='000';$('time').innerHTML='45<span>s</span>';}
    mode='playing';lastTime=performance.now();lastCut=-Infinity;$('overlay').hidden=true;controls();$('status').textContent='游戏开始，用左右方向键或 A、D 清理废稿。';
  }
  function pause() {
    if(mode==='paused'){start();return;}
    if(mode!=='playing')return;
    mode='paused';show('灵感休息中。','慢慢来，废稿不会自己长大。','继续落笔 ↗','已暂停');
  }
  function cut(direction) {
    if(mode!=='playing')return;
    const now=performance.now();if(now-lastCut<110)return;lastCut=now;side=direction;
    if(stack[0].hazard===side){finish(true);return;}
    const removed=stack.shift();stack.push(sheet());score++;stroke=reducedMotion?0:.24;
    $('score').textContent=String(score).padStart(3,'0');
    if(!reducedMotion)for(let i=0;i<7;i++)particles.push({x:width/2,y:466,vx:-side*(80+Math.random()*200)+(Math.random()-.5)*100,vy:-80-Math.random()*120,rotation:Math.random()*3,life:1,color:removed.color});
  }
  $('start').addEventListener('click',start);$('pause').addEventListener('click',pause);
  $('left').addEventListener('click',()=>cut(-1));$('right').addEventListener('click',()=>cut(1));
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)) {e.preventDefault();if(!e.repeat)cut(['ArrowLeft','a','A'].includes(e.key)?-1:1);}
    if(e.code==='Space' && e.target.tagName!=='BUTTON') {e.preventDefault();if(!e.repeat)pause();}
    if(e.key==='Escape'&&mode==='playing')pause();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
  window.addEventListener('blur',()=>{if(mode==='playing')pause();});
  function frame(now) {
    const dt=Math.min((now-lastTime)/1000,.1);lastTime=now;
    if(mode==='playing') {
      remaining=Math.max(0,remaining-dt);$('time').innerHTML=`${Math.ceil(remaining)}<span>s</span>`;
      stroke=Math.max(0,stroke-dt);
      particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=450*dt;p.rotation+=dt*3;p.life-=dt*1.8;});particles=particles.filter(p=>p.life>0);
      if(remaining===0)finish(false);
    }
    draw(now/1000);requestAnimationFrame(frame);
  }
  seed();resize();controls();new ResizeObserver(resize).observe(canvas);requestAnimationFrame(frame);
})();

module.exports = (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const base = process.env.BASE_URL || (proto + '://' + host);

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const script = `(function(){
var SF='${base}';
function init(k,id,opts){
  opts=opts||{};
  var el=document.getElementById(id);
  if(!el)return console.error('SocialFeed: element #'+id+' not found');
  el.innerHTML='<div style="text-align:center;padding:40px;font-family:sans-serif;color:#888;font-size:14px">Loading feed...</div>';
  fetch(SF+'/api/widget?apiKey='+k)
    .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
    .then(function(x){
      if(!x.ok)return el.innerHTML='<div style="color:#ef4444;padding:20px;text-align:center;font-family:sans-serif;font-size:13px">'+x.d.error+'</div>';
      render(el,x.d.feed,x.d.posts,opts);
    })
    .catch(function(){el.innerHTML='<div style="color:#ef4444;padding:20px;text-align:center;font-family:sans-serif">Could not load feed</div>';});
}
var PC={instagram:'#E4405F',youtube:'#FF0000',twitter:'#1DA1F2',x:'#000',facebook:'#1877F2',tiktok:'#010101',linkedin:'#0A66C2',reddit:'#FF4500'};
function ago(d){var s=Math.floor((new Date()-new Date(d))/1000);if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d';}
function fmt(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function render(el,f,posts,opts){
  var dark=(opts.theme||f.theme)==='dark';
  var bg=dark?'#0a0a0a':'#f5f5f5',cb=dark?'#1a1a1a':'#fff',tc=dark?'#e0e0e0':'#111',sc=dark?'#888':'#666',br=dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
  var cols=opts.columns||f.columns||3,gap=f.gap||16,rad=f.cardRadius||12;
  var isC=f.layout==='carousel';
  var gs=isC?'display:flex;overflow-x:auto;gap:'+gap+'px;padding-bottom:8px':'display:grid;grid-template-columns:repeat('+cols+',1fr);gap:'+gap+'px';
  var uid='sf'+Math.random().toString(36).substr(2,6);
  var st=document.createElement('style');
  st.textContent='.'+uid+' .c{background:'+cb+';border-radius:'+rad+'px;border:1px solid '+br+';overflow:hidden;transition:transform .2s,box-shadow .2s;cursor:pointer'+(isC?';min-width:260px;flex-shrink:0':'')+';box-sizing:border-box}.'+uid+' .c:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.3)}.'+uid+' .m{width:100%;aspect-ratio:1;object-fit:cover;display:block}.'+uid+' .ph{width:100%;aspect-ratio:1;background:'+(dark?'#222':'#eee')+';display:flex;align-items:center;justify-content:center;font-size:2em}.'+uid+' .b{padding:12px}.'+uid+' .h{display:flex;align-items:center;gap:8px;margin-bottom:8px}.'+uid+' .av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0}.'+uid+' .ui{flex:1;min-width:0}.'+uid+' .un{font-size:12px;font-weight:600;color:'+tc+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.'+uid+' .pl{font-size:10px;margin-top:1px}.'+uid+' .cp{font-size:12px;color:'+tc+';line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}.'+uid+' .ft{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:'+sc+'}.'+uid+' .st{display:flex;gap:8px}@media(max-width:600px){.'+uid+' .g{grid-template-columns:repeat(2,1fr)!important}}';
  document.head.appendChild(st);
  var html=posts.map(function(p){
    var c=PC[p.platform]||'#666',ini=(p.displayName||p.username||'?')[0].toUpperCase();
    var hm=p.media&&p.media[0];
    var isVid=['youtube','tiktok','vimeo'].indexOf(p.platform)>=0;
    return '<div class="c" onclick="window.open(\''+esc(p.url)+'\',\'_blank\')">'
      +(hm?'<img class="m" src="'+esc(p.media[0])+'" loading="lazy" onerror="this.style.display=\'none\'" />'
          :'<div class="ph">'+(isVid?'&#9654;':'&#128444;')+'</div>')
      +'<div class="b">'
      +(f.showAvatar||f.showUsername
        ?'<div class="h"><div class="av" style="background:'+c+'">'+ini+'</div>'
          +'<div class="ui">'
          +(f.showUsername?'<div class="un">'+esc(p.displayName||p.username)+'</div>':'')
          +(f.showPlatform?'<div class="pl" style="color:'+c+'">'+esc(p.platform)+'</div>':'')
          +'</div></div>':'')
      +(f.showCaption&&p.content?'<div class="cp">'+esc(p.content)+'</div>':'')
      +'<div class="ft">'
      +(f.showDate?'<span>'+ago(p.publishedAt)+'</span>':'<span></span>')
      +'<div class="st">'+(p.likes?'<span>&#10084; '+fmt(p.likes)+'</span>':'')+(p.comments?'<span>&#128172; '+fmt(p.comments)+'</span>':'')+'</div>'
      +'</div></div></div>';
  }).join('');
  el.innerHTML='<div class="'+uid+'" style="background:'+bg+';padding:'+gap+'px;border-radius:'+rad+'px"><div class="g" style="'+gs+'">'+html+'</div></div>';
}
window.SocialFeed={init:init};
})();`;

  res.send(script);
};

// VIN barcode scanner shared by the booking form and the report.
// Camera frames are decoded on the phone with zxing-cpp (WebAssembly); nothing is uploaded.
// Usage: scanVin(function(vin){...}, function(message){...})
(function(){
  // Scanning is for phones and tablets only: hide the button on desktops (mouse/trackpad, no touch screen)
  if(!matchMedia('(pointer: coarse)').matches){var sb=document.getElementById('scanBtn');if(sb)sb.hidden=true;var hm=document.getElementById('vinMsg');if(hm)hm.textContent='';}
  var LIB='https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.6/dist/iife/reader/index.js';
  var ANGLES=[0,20,-20,40,-40];// tryRotate covers 90/180/270; these cover tilt in between
  var ov,vid,tb,scanning=false,stream=null,cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true}),done;

  function build(){
    ov=document.createElement('div');
    ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Scan VIN barcode');
    ov.style.cssText='position:fixed;top:0;left:0;right:0;height:100dvh;z-index:300;background:#000;display:none;flex-direction:column;align-items:center;gap:12px;padding:max(12px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-sizing:border-box;font-family:inherit';
    ov.innerHTML='<p style="flex:none;color:#fff;margin:0;text-align:center;font-size:16px">Point at the VIN barcode on the door jamb or windshield.</p>'+
      '<video playsinline muted style="flex:1 1 auto;min-height:0;width:100%;max-width:640px;object-fit:cover;border-radius:8px;border:3px solid #F3DC6B"></video>'+
      '<div style="flex:none;display:flex;gap:10px">'+
      '<button type="button" data-t hidden style="min-height:44px;padding:0 18px;border-radius:999px;border:2px solid #56627c;background:transparent;color:#fff;font:700 15px inherit">Flash on</button>'+
      '<button type="button" data-c style="min-height:44px;padding:0 22px;border-radius:999px;border:0;background:#F3DC6B;color:#1A2233;font:700 15px inherit">Cancel</button></div>'+
      // iPhone has no vibrate API; tapping a hidden iOS 18 switch gives a haptic tick instead
      '<label data-h style="position:absolute;opacity:0;pointer-events:none"><input type="checkbox" switch></label>';
    document.body.appendChild(ov);
    vid=ov.querySelector('video');tb=ov.querySelector('[data-t]');
    ov.querySelector('[data-c]').onclick=stop;
  }
  function buzz(){
    try{if(navigator.vibrate)navigator.vibrate(60);}catch(e){}
    try{ov.querySelector('[data-h]').click();}catch(e){}
  }
  function stop(){scanning=false;if(stream)stream.getTracks().forEach(function(t){t.stop();});stream=null;if(vid)vid.srcObject=null;if(ov)ov.style.display='none';}
  function asVin(s){s=String(s).toUpperCase().replace(/[^A-Z0-9]/g,'');if(s.length===18&&s[0]==='I')s=s.slice(1);return s.length===17&&!/[IOQ]/.test(s)?s:null;}
  function frame(i){
    if(!scanning)return;
    if(vid.readyState<2||!vid.videoWidth)return setTimeout(function(){frame(i);},60);
    var k=Math.min(1,1280/Math.max(vid.videoWidth,vid.videoHeight)),w=vid.videoWidth*k,h=vid.videoHeight*k;
    var a=ANGLES[i%ANGLES.length]*Math.PI/180,W=Math.ceil(Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a))),H=Math.ceil(Math.abs(w*Math.sin(a))+Math.abs(h*Math.cos(a)));
    cv.width=W;cv.height=H;cx.setTransform(1,0,0,1,0,0);cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.translate(W/2,H/2);cx.rotate(a);cx.drawImage(vid,-w/2,-h/2,w,h);
    ZXingWASM.readBarcodes(cx.getImageData(0,0,W,H),{formats:['Code39','Code128','DataMatrix','QRCode'],tryHarder:true,tryRotate:true,maxNumberOfSymbols:4})
      .then(function(res){for(var n=0;n<res.length;n++){var v=asVin(res[n].text);if(v){buzz();stop();done(v);return;}}requestAnimationFrame(function(){frame(i+1);});})
      .catch(function(){requestAnimationFrame(function(){frame(i+1);});});
  }
  window.scanVin=function(onVin,onError){
    done=onVin;onError=onError||function(){};
    if(!ov)build();
    function start(){
      ov.style.display='flex';tb.hidden=true;
      navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}})
        .then(function(s){stream=s;vid.srcObject=s;return vid.play();})
        .then(function(){scanning=true;frame(0);
          // Flash: only shown when the phone's browser lets web pages control it
          var tr=stream.getVideoTracks()[0],cap=tr.getCapabilities?tr.getCapabilities():{},on=false;
          tb.hidden=!cap.torch;tb.textContent='Flash on';
          tb.onclick=function(){on=!on;tr.applyConstraints({advanced:[{torch:on}]}).then(function(){tb.textContent=on?'Flash off':'Flash on';}).catch(function(){tb.hidden=true;});};
        })
        .catch(function(){stop();onError('Camera not available. Type the VIN instead.');});
    }
    if(window.ZXingWASM)return start();
    var s=document.createElement('script');s.src=LIB;s.onload=start;
    s.onerror=function(){onError("Scanner couldn't load. Type the VIN instead.");};document.head.appendChild(s);
  };
})();

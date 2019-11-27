window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = null;
var unlocked = false;
var isPlaying = false;  //現在再生中かどうか
var startTime;
var current16thNote;  //現在の最後に予定されているメモは何か
var bpm = 60;
var lookahead = 25.0; //スケジューリング関数を呼び出す間隔(ミリ秒)
var scheduleAheadTime = 0.1;  //音をスケジュールする先読み時間の長さ(秒)
                              //先読みから計算され、タイマーが遅れた場合は次の間隔と重複する
var nextNoteTime = 0.0; //次のメモの期限が来たとき
var noteResolution = 0; //0 == 16分、1 == 8分、2 ==四分音符
var noteLength = 0.05;  //ビープ音の長さ(秒単位)
var beat = null;


function nextNote() {
  //現在の音符と時間を次の16分音符に進める
  //nextNoteTime変数とcurrent16thNote変数の更新
  var bps = 60 / bpm;
  nextNoteTime += 0.25 * bps;  //最後のビート時間に16分音符の長さのビートを追加する　16分音符 = 0.25 8分音符 = 0.5 4分音符 = bps
  current16thNote++;  //ビート番号を進めてゼロに折り返す
  if (current16thNote == 16) {
      current16thNote = 0;
  }
}

function scheduleNote( beatNumber, time ) {
  //次に鳴らすべきWebAudioの音をスケジューリングする

  if ( (noteResolution==1) && (beatNumber%2))
      return; //16分音符以外の8分音符は演奏しない
  if ( (noteResolution==2) && (beatNumber%4))
      return; //4分音符以外の8分音符を演奏しない
  
  //AudioBufferSourceノードを作成して任意の音をここで設定できる
  var source = context.createBufferSource();
  source.buffer = beat;
  source.connect(context.destination);
  source.start(time);
}

function scheduler() {
  //オーディオクロックの時間を取得し、次に鳴らすべき音の発音時刻と比較する
  //ほとんどはスケジュールされる音が存在せずに無処理で抜ける
  //存在したらWebAudioAPIを使って次の間隔の前に再生するノートをスケジュールし、ポインターを進める
  //この関数はlookaheadで設定したミリ秒ごとに呼ばれる
  while (nextNoteTime < context.currentTime + scheduleAheadTime ) {
      scheduleNote( current16thNote, nextNoteTime );
      nextNote();
  }
}

function play() {
  if (!unlocked) {
    //サイレントバッファを再生してオーディオのロックを解除します
    var silentBuffer = context.createBuffer(1, 1, 22050);
    var node = context.createBufferSource();
    node.buffer = silentBuffer;
    node.start(0);
    unlocked = true;
  }

  isPlaying = !isPlaying;

  if (isPlaying) { // start playing
      current16thNote = 0;
      nextNoteTime = context.currentTime;
      timerWorker.postMessage("start");
      return "stop";
  } else {
      timerWorker.postMessage("stop");
      return "play";
  }
}

var getAudioBuffer = function(url, fn) {  
  var request = new XMLHttpRequest();
  request.responseType = 'arraybuffer';

  request.onreadystatechange = function() {
    if (request.readyState === 4) {
      if (request.status === 0 || request.status === 200) {
        context.decodeAudioData(request.response, function(buffer) {
          fn(buffer);
        });
      }
    }
  };

  request.open('GET', url, true);
  request.send('');
};

function init(){
  context = new AudioContext();

  //オーディオファイルなどをロードする場合は、ここで行う
  getAudioBuffer('./sound/heart.mp3', function(buffer) {
    beat = buffer;
  });

  timerWorker = new Worker("worker.js");

  timerWorker.onmessage = function(e) {
  if (e.data == "tick") {
  // console.log("tick!");
  scheduler();
  }
  else
  console.log("message: " + e.data);
  };
  timerWorker.postMessage({"interval":lookahead});
}

window.addEventListener("load", init );

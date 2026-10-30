// ============================================================
// GLOBAL SAFE SOUND PLAYER (LAZY REUSED AUDIOCONTEXT)
// ============================================================
function playSound(type) {
  try {
    const isSoundOn = typeof localStorage !== 'undefined' ? localStorage.getItem('nv_sound') : null;
    if (isSoundOn === 'false') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window._globalAudioCtx) {
      window._globalAudioCtx = new AudioCtx();
    }
    if (window._globalAudioCtx.state === 'suspended') {
      window._globalAudioCtx.resume();
    }
    const audioContext = window._globalAudioCtx;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = type === 'success' ? 587.33 : type === 'pop' ? 700 : type === 'sos' ? 220 : type === 'gavel' ? 160 : 440;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.18);
    osc.start();
    osc.stop(audioContext.currentTime + 0.18);
  } catch (e) {
    // KhÃ´ng bao giá» cháº·n luá»“ng xá»­ lÃ½ chÃ­nh khi Ã¢m thanh bá»‹ trÃ¬nh duyá»‡t háº¡n cháº¿
  }
}
window.playSound = playSound;

// ============================================================
// GLOBAL SAFE NOTIFICATION DISPATCHER
// ============================================================
function addNotification(title, message, type = 'info') {
  try {
    let msg = message;
    let t = type;
    let head = title;
    if (arguments.length === 1) {
      msg = title;
      head = 'ThÃ´ng bÃ¡o';
      t = 'info';
    } else if (arguments.length === 2 && ['info', 'success', 'warning', 'error'].includes(message)) {
      t = message;
      msg = title;
      head = 'ThÃ´ng bÃ¡o';
    }
    if (typeof window !== 'undefined' && typeof window.__dispatchNotification === 'function') {
      window.__dispatchNotification(msg || head, t);
    }
    if (typeof notifications !== 'undefined' && Array.isArray(notifications)) {
      notifications.unshift({
        id: Date.now().toString(),
        title: head || 'ThÃ´ng bÃ¡o',
        message: msg || '',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        type: t,
        read: false
      });
      if (typeof renderNotifications === 'function') renderNotifications();
      if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    }
  } catch (err) {
    console.warn("Lá»—i khi thÃªm notification:", err);
  }
}
window.addNotification = addNotification;

const { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } = React;

// ============================================================
// FIREBASE CONFIG & INITIALIZATION
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBUIu9TdS6mlDSJHueA9k-HCDLUEWatRKs",
  authDomain: "newvision-hub.firebaseapp.com",
  projectId: "newvision-hub",
  storageBucket: "newvision-hub.firebasestorage.app",
  messagingSenderId: "706530405930",
  appId: "1:706530405930:web:364142c52dcbe88bee5d53",
  measurementId: "G-DPW81VBMVB"
};

let fbApp = null;
let fbDb = null;
let fbMessaging = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      fbApp = firebase.initializeApp(firebaseConfig);
    } else {
      fbApp = firebase.app();
    }
    fbDb = firebase.firestore();
    try {
      fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    } catch(e) {}

    try {
      if (firebase.messaging && typeof firebase.messaging.isSupported === 'function' && firebase.messaging.isSupported()) {
        fbMessaging = firebase.messaging();
      }
    } catch(e) {}
  }
} catch(e) {
  console.warn('Firebase init error:', e);
}

// Web Push Notification Helper
function showWebPush(title, body, options = {}) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const defaultIcon = 'https://cdn-icons-png.flaticon.com/512/3253/3253106.png';
      const notif = new Notification(title, {
        body: body || '',
        icon: options.icon || defaultIcon,
        badge: options.badge || defaultIcon,
        tag: options.tag || 'newvision-notification',
        renotify: true,
        ...options
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return notif;
    } catch(e) {
      console.warn('showWebPush error:', e);
    }
  }
  return null;
}

// ============================================================
// CONSTANTS
// ============================================================
const BANS = ['Ban Chá»§ Nhiá»‡m','Ban Sá»± Kiá»‡n','Ban Truyá»n ThÃ´ng Ká»¹ Thuáº­t','Ban Äá»‘i Ngoáº¡i','Ban Ná»™i Vá»¥','ToÃ n CLB'];
const MEMBER_ROLES = ['Ban Chá»§ Nhiá»‡m','TrÆ°á»Ÿng/PhÃ³ Ban','ThÃ nh viÃªn chÃ­nh thá»©c','CTV'];
const DECISION_STATUSES = ['Äang bÃ n báº¡c','Cáº§n duyá»‡t','ÄÃ£ chá»‘t chÃ­nh thá»©c'];
const EVAL_OPTIONS = ['Äáº¡t','Cáº§n theo dÃµi','KhÃ´ng Ä‘áº¡t'];
const ATTEND_OPTIONS = ['CÃ³ máº·t','Váº¯ng','CÃ³ phÃ©p'];
const TASK_OPTIONS = ['ÄÃºng háº¡n','Trá»… háº¡n','ChÆ°a ná»™p'];
const TASK_PHASES = ['Chuáº©n bá»‹ trÆ°á»›c sá»± kiá»‡n','Trong thá»i gian sá»± kiá»‡n'];
const SKILL_TAGS = ['MC','Canva','Content','Háº­u cáº§n','Äá»‘i ngoáº¡i','Chá»¥p áº£nh','Quay phim','Design','Excel','Thuyáº¿t trÃ¬nh','Ã‚m thanh & Ãnh sÃ¡ng','Trang trÃ­','Viáº¿t Script','Social Media','Äá»“ hoáº¡','Livestream'];
const CLASS_YEARS = ['K74','K75','K76','K77','K78','K79','K80','K81','K82','K83','K84'];
const LINK_TYPES = ['Káº¿ hoáº¡ch & Ká»‹ch báº£n','Báº£ng tÃ­nh & Data','TÆ° liá»‡u & Media','BiÃªn báº£n & HÃ nh chÃ­nh'];
const INVENTORY_STATUSES = ['Tá»‘t','Há»ng/Máº¥t phá»¥ kiá»‡n','Äang cho mÆ°á»£n'];
const EXPENSE_STATUSES = ['Dá»± trÃ¹','ÄÃ£ chi - Chá» hoÃ n tiá»n','ÄÃ£ quyáº¿t toÃ¡n'];
const COLOR_THEMES = [
  {id:'orange',name:'Cam NewVision',sub:'Cam & Navy',c1:'#f97316',c2:'#1e3a5f',badge:'Cam & Navy'},
  {id:'indigo',name:'TÃ­m Indigo',sub:'Indigo & Violet',c1:'#4f46e5',c2:'#7c3aed',badge:'Indigo'},
  {id:'green',name:'Xanh DÆ°á»£c HÃ  Ná»™i',sub:'Emerald & Teal',c1:'#059669',c2:'#0f766e',badge:'Emerald'},
];
const MASCOT_TYPES = [
  {id:'vivi',name:'CÃº mÃ¨o Vi Vi',icon:'ðŸ¦‰',desc:'Tri thá»©c & kiÃªn Ä‘á»‹nh'},
  {id:'eagle',name:'Äáº¡i bÃ ng NewVision',icon:'ðŸ¦…',desc:'Bá»©t phÃ¡ & báº£n lÄ©nh'},
];

const GACHA_CARDS = [
  { id: 1, name: "The Sun - HÃ o Quang Rá»±c Rá»¡", quote: "VÅ© trá»¥ báº­t Ä‘Ã¨n pha chiáº¿u tháº³ng vÃ o báº¡n. HÃ´m nay vÃ o lab chuáº©n Ä‘á»™ ra mÃ u há»“ng cÃ¡nh sen nháº¡t huyá»n thoáº¡i ngay láº§n Ä‘áº§u, khÃ´ng bá»‹ tháº§y cÃ´ báº¯t Ä‘á»• Ä‘i lÃ m láº¡i." },
  { id: 2, name: "The Star - NgÃ´i Sao Hy Vá»ng", quote: "Má»™t tÃ­n hiá»‡u chá»¯a lÃ nh tá»« cÃ¡c vÃ¬ sao: Deadline khÃ³ nháº±n tá»± Ä‘á»™ng Ä‘Æ°á»£c lÃ¹i thÃªm 48 tiáº¿ng, hoáº·c bÃ i táº­p nhÃ³m bá»—ng cÃ³ ai Ä‘Ã³ gÃ¡nh háº¿t pháº§n viá»‡c hÃ³c bÃºa nháº¥t." },
  { id: 3, name: "The Wheel of Fortune - BÃ¡nh Xe Sá»‘ Pháº­n", quote: "BÃ¡nh xe phong thá»§y Ä‘áº£o chiá»u ngoáº¡n má»¥c. Äen Ä‘á»§i tuáº§n trÆ°á»›c dá»«ng láº¡i á»Ÿ Ä‘Ã¢y; hÃ´m nay thi tráº¯c nghiá»‡m lá»¥i bá»«a theo linh cáº£m cÃ¢u nÃ o, Äƒn cháº¯c cÃ¢u Ä‘Ã³." },
  { id: 4, name: "The Magician - Báº­c Tháº§y Thao TÃºng", quote: "HÃ´m nay tÃ i Äƒn nÃ³i Ä‘áº¡t Ä‘á»‰nh cáº£nh giá»›i. Thi váº¥n Ä‘Ã¡p chá»‰ cáº§n má»Ÿ miá»‡ng nÃ³i ba cÃ¢u Ä‘Ãºng tá»« khÃ³a trá»ng tÃ¢m, tháº§y cÃ´ liá»n gáº­t Ä‘áº§u má»‰m cÆ°á»i cho qua mÃ´n Ãªm Ä‘áº¹p." },
  { id: 5, name: "The World - Äáº¡i CÃ¡t ToÃ n Váº¹n", quote: "Má»™t chu ká»³ sÃ³ng giÃ³ chÃ­nh thá»©c khÃ©p láº¡i. Äiá»ƒm danh vá»«a Ä‘á»§, bÃ i táº­p ná»™p xong trÆ°á»›c háº¡n 5 phÃºt, tá»‘i nay kÃª cao gá»‘i ngá»§ khÃ´ng ai dÃ¡m rÃ©o tÃªn." },
  { id: 6, name: "The Empress - NÄƒng LÆ°á»£ng TrÃ¹ PhÃº", quote: "Cung tÃ i lá»™c má»Ÿ rá»™ng báº¥t thÆ°á»ng. VÃ­ tiá»n cÃ³ dáº¥u hiá»‡u há»“i sinh nhá» Ä‘Æ°á»£c ai Ä‘Ã³ bao Äƒn, hoáº·c tÃ i khoáº£n ná»• ting ting má»™t khoáº£n tiá»n tá»« trÃªn trá»i rÆ¡i xuá»‘ng." },
  { id: 7, name: "The Chariot - Cá»— Xe Tháº§n Tá»‘c", quote: "Ã chÃ­ vÆ°á»£t chÆ°á»›ng ngáº¡i váº­t cá»±c máº¡nh. Giáº£ng viÃªn lÆ°á»›t slide nhanh nhÆ° chá»›p nhÆ°ng tay báº¡n ghi chÃ©p váº«n Ä‘uá»•i ká»‹p trá»n váº¹n báº£n cháº¥t bÃ i giáº£ng." },
  { id: 8, name: "The High Priestess - GiÃ¡c Quan Thá»© SÃ¡u", quote: "Trá»±c giÃ¡c mÃ¡ch báº£o gÃ¬ hÃ£y nghe theo náº¥y. Tá»‘i nay linh tÃ­nh báº£o giá»Ÿ trang nÃ o trong giÃ¡o trÃ¬nh thÃ¬ láº­t Ä‘Ãºng trang Ä‘Ã³, xÃ¡c suáº¥t trÃºng Ä‘á» thi ngÃ y mai lÃªn tá»›i 99%." },
  { id: 9, name: "Strength - Thuáº§n HÃ³a CÄƒng Tháº³ng", quote: "TÃ¢m báº¥t biáº¿n giá»¯a dÃ²ng Ä‘á»i váº¡n biáº¿n. Khá»‘i lÆ°á»£ng bÃ i vá»Ÿ dÃ¹ cháº¥t thÃ nh Ä‘á»‘ng cÅ©ng bá»‹ báº¡n giáº£i quyáº¿t gá»n gháº½ chá»‰ trong má»™t buá»•i chiá»u nghe nháº¡c chill." },
  { id: 10, name: "The Hermit - Thuáº­t TÃ ng HÃ¬nh áº¨n SÄ©", quote: "HÃ´m nay váº­n khÃ­ 'á»Ÿ áº©n' che chá»Ÿ tuyá»‡t Ä‘á»‘i. Giáº£ng viÃªn Ä‘áº£o máº¯t quanh giáº£ng Ä‘Æ°á»ng tÃ¬m ngÆ°á»i lÃªn báº£ng nhÆ°ng Ã¡nh nhÃ¬n sáº½ lÆ°á»›t qua báº¡n nhÆ° thá»ƒ báº¡n lÃ  ngÆ°á»i vÃ´ hÃ¬nh." },
  { id: 11, name: "The Fool - VÃ´ Æ¯u VÃ´ Lo", quote: "Cá»© thong dong bÆ°á»›c ra Ä‘Æ°á»ng. Äi há»c gáº·p toÃ n Ä‘Ã¨n xanh, trá»i rÃ¢m mÃ¡t, vá»«a dáº¯t xe vÃ o trÆ°á»ng lÃ  báº¯t gáº·p ngay má»™t chá»— Ä‘á»— xe cÃ³ bÃ³ng rÃ¢m mÃ¡t rÆ°á»£i." },
  { id: 12, name: "Temperance - CÃ¢n Báº±ng Ã‚m DÆ°Æ¡ng", quote: "NguyÃªn tá»‘ Äáº¥t vÃ  NÆ°á»›c hÃ²a há»£p tuyá»‡t Ä‘á»‘i. Äiá»ƒm chuyÃªn cáº§n vÃ  Ä‘iá»ƒm thi giá»¯a ká»³ bÃ¹ trá»« cho nhau ra Ä‘Ãºng con sá»‘ vá»«a váº·n qua mÃ´n khÃ´ng thiáº¿u má»™t pháº©y." },
  { id: 13, name: "Judgement - Nghiá»‡p Quáº£ Ngá»t NgÃ o", quote: "Nhá»¯ng Ä‘Ãªm cÃ y bÃ i trong bÃ³ng tá»‘i hÃ´m nay Ä‘Æ°á»£c há»“i Ä‘Ã¡p xá»©ng Ä‘Ã¡ng. Báº£ng Ä‘iá»ƒm tráº£ vá» hiá»‡n chá»¯ 'Äáº T' to Ä‘Ã¹ng khiáº¿n báº¡n thá»Ÿ phÃ o nháº¹ nhÃµm cáº£ ngÆ°á»i." },
  { id: 14, name: "The Hierophant - QuÃ½ NhÃ¢n Chá»‰ Lá»‘i", quote: "Báº¯t Ä‘Æ°á»£c sÃ³ng nÄƒng lÆ°á»£ng cá»§a tiá»n bá»‘i khÃ³a trÃªn. MÆ°á»£n Ä‘Æ°á»£c cuá»‘n giÃ¡o trÃ¬nh cÃ³ sáºµn bÃºt dáº¡ quang highlight trÃºng tim Ä‘en Ä‘á» thi nÄƒm nay." },
  { id: 15, name: "The Lovers - DuyÃªn LÃ nh NhÃ³m TrÆ°á»Ÿng", quote: "VÅ© trá»¥ káº¿t ná»‘i báº¡n vá»›i nhá»¯ng ngÆ°á»i Ä‘á»“ng Ä‘á»™i lÃ m viá»‡c nhÃ³m cÃ³ tÃ¢m: phÃ¢n cÃ´ng lÃ  lÃ m, khÃ´ng seen tin nháº¯n rá»“i biáº¿n máº¥t bÃ­ áº©n." },
  { id: 16, name: "Sao Thá»§y Thuáº­n HÃ nh", quote: "TÆ° duy logic thÃ´ng suá»‘t láº¡ ká»³. Máº¥y cÃ´ng thá»©c hÃ³a dÆ°á»£c dÃ i ngoáº±ng hay sÆ¡ Ä‘á»“ chuyá»ƒn hÃ³a ráº¯c rá»‘i nhÃ¬n lÆ°á»›t qua má»™t láº§n lÃ  kháº¯c sÃ¢u vÃ o vá» nÃ£o." },
  { id: 17, name: "Lá»­a Báº¡ch DÆ°Æ¡ng Rá»±c ChÃ¡y", quote: "NÄƒng lÆ°á»£ng bÃ¹ng ná»•. Sá»± trÃ¬ hoÃ£n bá»‹ Ä‘Ã¡nh báº¡i, ngá»“i vÃ o bÃ n Ä‘Ãºng 2 tiáº¿ng lÃ  dá»n sáº¡ch toÃ n bá»™ bÃ i táº­p tá»“n Ä‘á»ng cá»§a cáº£ tuáº§n." },
  { id: 18, name: "Äáº¥t Kim NgÆ°u Vá»¯ng ChÃ£i", quote: "HÃ´m nay vÃ­ tiá»n Ä‘Æ°á»£c báº£o vá»‡ an toÃ n. Xuá»‘ng cÄƒng-tin giá» cao Ä‘iá»ƒm váº«n chá»™p Ä‘Æ°á»£c suáº¥t cÆ¡m ngon lÃ nh, no cÄƒng bá»¥ng vá»›i giÃ¡ sinh viÃªn." },
  { id: 19, name: "NÆ°á»›c Cá»± Giáº£i ÃŠm Äá»m", quote: "TÃ¢m trÃ­ bÃ¬nh yÃªn nhÆ° máº·t há»“ khÃ´ng má»™t gá»£n sÃ³ng. KhÃ´ng drama, khÃ´ng tin nháº¯n giá»¥c viá»‡c, chá»‰ cÃ³ sá»± tháº£nh thÆ¡i trá»n váº¹n cáº£ ngÃ y dÃ i." },
  { id: 20, name: "Sao Má»™c Báº£o Há»™", quote: "Váº­n may Ä‘áº¿n vÃ o phÃºt chÃ³t: Äi há»c sÃ¡t giá» nhÆ°ng vá»«a Ä‘áº·t chÃ¢n qua cá»­a lá»›p thÃ¬ tiáº¿ng chuÃ´ng Ä‘iá»ƒm danh má»›i báº¯t Ä‘áº§u vang lÃªn." },
  { id: 21, name: "Sao Kim DuyÃªn DÃ¡ng", quote: "HÃ´m nay báº¡n tá»a ra nguá»“n nÄƒng lÆ°á»£ng dá»… máº¿n láº¡ thÆ°á»ng. Äi thá»±c táº­p hay lÃªn lá»›p Ä‘á»u Ä‘Æ°á»£c má»i ngÆ°á»i xung quanh nhiá»‡t tÃ¬nh giÃºp Ä‘á»¡, nhÆ°á»ng nhá»‹n tá»«ng chÃºt." },
  { id: 22, name: "Quáº» Thuáº§n CÃ n - Váº­n KhÃ­ ThÄƒng Hoa", quote: "Má»i sá»± khá»Ÿi Ä‘áº§u hÃ´m nay Ä‘á»u trÆ¡n tru nhÆ° bÃ´i dáº§u. Ná»™p bÃ¡o cÃ¡o qua web trÆ°á»ng máº¡ng cháº¡y vÃ¨o vÃ¨o, khÃ´ng gáº·p cáº£nh xoay vÃ²ng trÃ²n á»©c cháº¿." },
  { id: 23, name: "Quáº» Äá»‹a ThiÃªn ThÃ¡i - HÃ³a Nguy ThÃ nh An", quote: "TÆ°á»Ÿng chá»«ng quÃªn mang theo tÃ i liá»‡u há»c táº­p, hÃ³a ra báº¡n cÃ¹ng bÃ n Ä‘Ã£ in dÆ° má»™t báº£n rá»“i Ä‘Æ°a ngay cho báº¡n dÃ¹ng." },
  { id: 24, name: "Quáº» Thá»§y Há»a KÃ½ Táº¿ - TrÃ²n Váº¹n Ã Nguyá»‡n", quote: "Tiáº¿n Ä‘á»™ Ã´n thi Ä‘Ã£ vÃ o guá»“ng chuáº©n chá»‰. Chá»‰ cáº§n giá»¯ vá»¯ng nhá»‹p Ä‘á»™ nÃ y, báº¡n cáº§m cháº¯c chiáº¿c vÃ© qua mÃ´n vá»›i sá»‘ Ä‘iá»ƒm Ä‘áº¹p máº¯t." },
  { id: 25, name: "Quáº» Phong LÃ´i Ãch - TrÃ­ NÃ£o Bá»©t PhÃ¡", quote: "NÃ£o bá»™ hÃ´m nay tiáº¿p thu kiáº¿n thá»©c vá»›i tá»‘c Ä‘á»™ cÃ¡p quang. Máº¥y cÃ¢u há»i hÃ³c bÃºa tÆ°á»Ÿng khÃ´ng giáº£i ná»•i bá»—ng nhiÃªn tÃ¬m ra chÃ¬a khÃ³a Ä‘Ã¡p Ã¡n." },
  { id: 26, name: "Sao Thá»• LÃ¹i BÆ°á»›c", quote: "Ãp lá»±c lá»›n nháº¥t cá»§a tuáº§n Ä‘Ã£ chÃ­nh thá»©c tan biáº¿n. HÃ´m nay lÃ  ngÃ y tá»± thÆ°á»Ÿng cho báº£n thÃ¢n má»™t buá»•i chiá»u Ä‘i dáº¡o hoáº·c náº±m dÃ i lÆ°á»›t web." },
  { id: 27, name: "TÃ­n Hiá»‡u Máº·t TrÄƒng", quote: "Máº¯t tháº§n má»Ÿ ra. Soi kÃ­nh hiá»ƒn vi báº¯t dÃ­nh vi trÆ°á»ng nÃ©t cÄƒng ngay vÃ²ng váº·n á»‘c vi cáº¥p Ä‘áº§u tiÃªn, báº¡n bÃ¨ xung quanh bu láº¡i xin chá»¥p kÃ© lia lá»‹a." },
  { id: 28, name: "ThiÃªn Thá»i Äá»‹a Lá»£i", quote: "Thá»i tiáº¿t chiá»u lÃ²ng ngÆ°á»i. Vá»«a tan há»c dáº¯t xe ra cá»•ng thÃ¬ trá»i rÃ¢m mÃ¡t, vá» Ä‘áº¿n táº­n phÃ²ng trá» khÃ³a cá»­a xong bÃªn ngoÃ i má»›i báº¯t Ä‘áº§u trÃºt mÆ°a rÃ o." },
  { id: 29, name: "KhiÃªn Cháº¯n TÃ¢m Linh", quote: "Váº­n xui tá»± Ä‘á»™ng báº­t ngÆ°á»£c ra xa. VÃ o phÃ²ng thá»±c táº­p lÃ m viá»‡c Ãªm ru: khÃ´ng vá»¡ á»‘ng nghiá»‡m, khÃ´ng Ä‘á»• hÃ³a cháº¥t, an toÃ n lÃ nh láº·n Ä‘i vá»." },
  { id: 30, name: "Quáº» Há»a Äá»‹a Táº¥n - Tá»a SÃ¡ng", quote: "BÃ i phÃ¡t biá»ƒu hoáº·c cÃ¢u tráº£ lá»i ngáº«u há»©ng trong lá»›p khiáº¿n giáº£ng viÃªn pháº£i má»‰m cÆ°á»i gáº­t gÃ¹ khen ngá»£i trÆ°á»›c máº·t báº¡n bÃ¨." },
  { id: 31, name: "ThiÃªn Tháº§n 111 - Ã Niá»‡m ThÃ nh Hiá»‡n Thá»±c", quote: "VÅ© trá»¥ Ä‘ang láº¯ng nghe suy nghÄ© cá»§a báº¡n. LÃºc lÃ m bÃ i tráº¯c nghiá»‡m, hÃ£y kiÃªn Ä‘á»‹nh chá»n Ä‘Ã¡p Ã¡n Ä‘áº§u tiÃªn lÃ³e lÃªn trong Ä‘áº§u, Ä‘á»«ng xÃ³a Ä‘i chá»n láº¡i." },
  { id: 32, name: "ThiÃªn Tháº§n 222 - BÃ¬nh TÃ¢m Chá» Äá»£i", quote: "Má»i sá»± an bÃ i Ä‘á»u diá»…n ra Ä‘Ãºng lÃºc. Äá»«ng quÃ¡ sá»‘t ruá»™t chá» Ä‘iá»ƒm sá»‘, káº¿t quáº£ tráº£ vá» sáº½ khiáº¿n báº¡n thá»Ÿ phÃ o ná»Ÿ ná»¥ cÆ°á»i." },
  { id: 33, name: "ThiÃªn Tháº§n 333 - QuÃ½ NhÃ¢n VÃ¢y Quanh", quote: "HÃ´m nay xung quanh toÃ n ngÆ°á»i tá»‘t bá»¥ng. Äang bÃ­ bÃ i táº­p khÃ³ chá»‰ cáº§n buÃ´ng má»™t cÃ¢u than thá»Ÿ lÃ  cÃ³ ngÆ°á»i giáº£ng giáº£i cáº·n káº½ tá»«ng bÆ°á»›c." },
  { id: 34, name: "ThiÃªn Tháº§n 444 - HÃ o Quang Báº¥t Kháº£ XÃ¢m Pháº¡m", quote: "Báº¡n Ä‘Æ°á»£c bao bá»c bá»Ÿi má»™t lá»›p khiÃªn nÄƒng lÆ°á»£ng bÃ¬nh yÃªn. Má»i lá»i phÃ n nÃ n xung quanh Ä‘á»u trÃ´i tuá»™t ra ngoÃ i, tÃ¢m tráº¡ng khÃ´ng chÃºt gá»£n sÃ³ng." },
  { id: 35, name: "ThiÃªn Tháº§n 555 - Lá»‘i Ráº½ Báº¥t Ngá»", quote: "Sáº¯p cÃ³ má»™t tin tá»©c mang láº¡i niá»m vui nho nhá»: Má»™t tiáº¿t há»c Ä‘Æ°á»£c Ä‘á»•i sang hÃ¬nh thá»©c nháº¹ nhÃ ng hÆ¡n hoáº·c báº¥t ngá» Ä‘Æ°á»£c cho nghá»‰ sá»›m." },
  { id: 36, name: "ThiÃªn Tháº§n 777 - Khai ThÃ´ng TrÃ­ Tuá»‡", quote: "TÃºi khÃ´n hÃ´m nay má»Ÿ rá»™ng háº¿t cá»¡. Gáº·p bÃ i toÃ¡n hÃ³c bÃºa tá»± dÆ°ng Ä‘áº§u Ã³c náº£y sá»‘ ra cÃ¡ch lÃ m nhanh gá»n báº¥t ngá»." },
  { id: 37, name: "ThiÃªn Tháº§n 888 - TÃ i KhÃ­ Dá»“i DÃ o", quote: "DÃ²ng cháº£y tiá»n báº¡c hanh thÃ´ng. ThÃ² tay vÃ o tÃºi Ã¡o khoÃ¡c cÅ© bá»—ng tÃ¬m láº¡i Ä‘Æ°á»£c tá» tiá»n gáº¥p gá»n ngá»¡ Ä‘Ã£ Ä‘Ã¡nh rÆ¡i tá»« tuáº§n trÆ°á»›c." },
  { id: 38, name: "ThiÃªn Tháº§n 999 - Trá»n Váº¹n Chu Ká»³", quote: "GÃ¡c láº¡i toÃ n bá»™ nhá»¯ng lo Ã¢u cá»§a bÃ i vá»Ÿ ngÃ y cÅ©. Tá»‘i nay báº¡n xá»©ng Ä‘Ã¡ng Ä‘Æ°á»£c thÆ°á»Ÿng má»™t ly trÃ  sá»¯a ngá»t ngÃ o vÃ  má»™t giáº¥c ngá»§ say khÃ´ng má»™ng má»‹." },
  { id: 39, name: "Con Sá»‘ 000 - Tiá»m NÄƒng VÃ´ Cá»±c", quote: "NgÃ y hÃ´m nay lÃ  má»™t trang giáº¥y hoÃ n toÃ n má»›i. Má»i may máº¯n Ä‘á»u náº±m trong tay báº¡n, tá»± tin bÆ°á»›c Ä‘i lÃ  gáº·t hÃ¡i káº¿t quáº£ tá»‘t." },
  { id: 40, name: "LÃ¡ BÃ i Äá»‹nh Má»‡nh - Váº­n Äá» ToÃ n Diá»‡n", quote: "LÃ¡ quáº» may máº¯n nháº¥t trong ngÃ y. Má»i sá»± mong cáº§u tá»« viá»‡c trÃ¡nh bá»‹ gá»i tÃªn, trÃºng Ä‘á» thi Ä‘áº¿n thá»i tiáº¿t khÃ´ rÃ¡o Ä‘á»u diá»…n ra Ä‘Ãºng nhÆ° Ã½ báº¡n mong muá»‘n." }
];
const MASCOT_MESSAGES = [
  'NewVision cá»‘ lÃªn! ðŸ’ª','Team mÃ¬nh lÃ m tá»‘t láº¯m! ðŸŒŸ','HÃ´m nay nÄƒng suáº¥t siÃªu cao! ðŸš€',
  'Vi Vi tá»± hÃ o vá» cÃ¡c báº¡n! ðŸ¦‰','CÃ¹ng nhau lÃ m Ä‘iá»u tuyá»‡t vá»i! âœ¨','Focus mode: ON! ðŸŽ¯',
  'NewVision â€“ Táº§m nhÃ¬n má»›i, Bá»©t phÃ¡ má»›i! ðŸ”¥','Chá»‰ cÃ²n chÃºt ná»¯a thÃ´i, cá»‘ lÃªn! ðŸ’«',
  'Má»—i viá»‡c nhá» táº¡o nÃªn Ä‘iá»u lá»›n! ðŸŒˆ','HÃ­t thá»Ÿ sÃ¢u, má»i thá»© sáº½ á»•n! ðŸŒ¸',
];
const EAGLE_MESSAGES = [
  'Äáº¡i bÃ ng NewVision tung cÃ¡nh! ðŸ¦…','Táº§m nhÃ¬n má»›i, Bá»©t phÃ¡ má»›i! ðŸš€','Má»¥c tiÃªu Ä‘Ã£ Ä‘á»‹nh, tiáº¿n lÃªn nÃ o! ðŸŽ¯',
  'Bay cao vÃ  xa hÆ¡n má»—i ngÃ y! âœ¨','Táº­p trung cao Ä‘á»™ â€“ KhÃ´ng gÃ¬ lÃ  khÃ´ng thá»ƒ! ðŸ”¥','Báº£n lÄ©nh NewVision dáº«n lá»‘i! ðŸŒŸ',
  'LÃ m viá»‡c háº¿t mÃ¬nh, bÃ¹ng ná»• háº¿t sá»©c! âš¡','NewVision â€“ Kháº³ng Ä‘á»‹nh vá»‹ tháº¿! ðŸ†',
];
const DEFAULT_VENUE_ITEMS = [
  {id:'chairs',label:'BÃ n gháº¿',icon:'armchair'},
  {id:'projector',label:'MÃ¡y chiáº¿u',icon:'monitor'},
  {id:'ac',label:'Äiá»u hÃ²a',icon:'wind'},
  {id:'speaker',label:'Loa & Mic',icon:'volume-2'},
  {id:'refreshments',label:'NÆ°á»›c & BÃ¡nh káº¹o',icon:'coffee'},
  {id:'gifts',label:'QuÃ  khÃ¡ch má»i',icon:'gift'},
];
const LINK_TYPE_CFG = {
  'Káº¿ hoáº¡ch & Ká»‹ch báº£n':{icon:'file-text',bg:'bg-blue-100',text:'text-blue-600',border:'border-blue-200'},
  'Báº£ng tÃ­nh & Data':{icon:'table-2',bg:'bg-emerald-100',text:'text-emerald-600',border:'border-emerald-200'},
  'TÆ° liá»‡u & Media':{icon:'image',bg:'bg-purple-100',text:'text-purple-600',border:'border-purple-200'},
  'BiÃªn báº£n & HÃ nh chÃ­nh':{icon:'stamp',bg:'bg-amber-100',text:'text-amber-600',border:'border-amber-200'},
};

// ============================================================
// UTILS
// ============================================================
function uid(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36)}
function fmtDate(d){if(!d)return'â€”';const dt=new Date(d);return isNaN(dt.getTime())?d:dt.toLocaleDateString('vi-VN')}
function fmtVND(n){if(n===undefined||n===null||n==='')return'â€”';return new Intl.NumberFormat('vi-VN').format(Number(n))+'â‚«'}
function isOverdue(dateStr){if(!dateStr)return false;return new Date(dateStr)<new Date()}
function isSoon(dateStr){if(!dateStr)return false;const diff=new Date(dateStr)-new Date();return diff>0&&diff<24*3600*1000}
function relTime(isoStr){const diff=Date.now()-new Date(isoStr).getTime();const m=Math.floor(diff/60000);const h=Math.floor(m/60);const d=Math.floor(h/24);if(m<1)return'Vá»«a xong';if(m<60)return`${m} phÃºt trÆ°á»›c`;if(h<24)return`${h} giá» trÆ°á»›c`;if(d<7)return`${d} ngÃ y trÆ°á»›c`;return new Date(isoStr).toLocaleDateString('vi-VN')}
function statusColor(s){if(s==='ÄÃ£ chá»‘t chÃ­nh thá»©c')return'tag-green';if(s==='Cáº§n duyá»‡t')return'tag-yellow';return'tag-blue'}
function evalColor(e){if(e==='Äáº¡t')return'tag-green';if(e==='KhÃ´ng Ä‘áº¡t')return'tag-red';return'tag-yellow'}
function taskColor(t){if(t==='ÄÃºng háº¡n')return'tag-green';if(t==='Trá»… háº¡n')return'tag-red';return'tag-gray'}
function attendColor(a){if(a==='CÃ³ máº·t')return'tag-green';if(a==='Váº¯ng')return'tag-red';return'tag-yellow'}
function expenseColor(s){if(s==='ÄÃ£ quyáº¿t toÃ¡n')return'tag-green';if(s==='ÄÃ£ chi - Chá» hoÃ n tiá»n')return'tag-yellow';return'tag-blue'}
function exportJSON(data,filename){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)}

// ============================================================
// HOOKS
// ============================================================
function useLocalStorage(key,init){
  const[val,setVal]=useState(()=>{try{const s=localStorage.getItem(key);return s?JSON.parse(s):init}catch{return init}});
  useEffect(()=>{localStorage.setItem(key,JSON.stringify(val))},[key,val]);
  return[val,setVal]
}

// ============================================================
// ICON WRAPPER
// ============================================================
function Icon({name,size=18,className=''}){
  const ref=useRef(null);
  useEffect(()=>{
    if(ref.current&&window.lucide){
      ref.current.innerHTML='';
      const nm=name.replace(/(^\w|-\w)/g,c=>c.replace('-','').toUpperCase());
      const svg=lucide.createElement(lucide[nm]);
      if(svg){svg.setAttribute('width',size);svg.setAttribute('height',size);ref.current.appendChild(svg)}
    }
  },[name,size]);
  return <span ref={ref} className={`inline-flex items-center justify-center ${className}`}/>;
}

// ============================================================
// CONTEXT & SEED CONSTANTS
// ============================================================
const SAMPLE_STUDY_RESOURCES = [
  {
    title: 'Tá»•ng há»£p Bá»™ Ä‘á» thi DÆ°á»£c lÃ½ 1 (K77 - K79) cÃ³ Ä‘Ã¡p Ã¡n chi tiáº¿t',
    block: 'CÆ¡ sá»Ÿ ngÃ nh',
    category: 'Äá» thi & ÄÃ¡p Ã¡n',
    url: 'https://drive.google.com/drive/folders/newvision-duocly1',
    contributor: 'BCN Há»c táº­p NVC',
    note: 'TÃ i liá»‡u trá»ng tÃ¢m Ã´n thi háº¿t mÃ´n, bÃ¡m sÃ¡t cáº¥u trÃºc Ä‘á» tráº¯c nghiá»‡m vÃ  ca lÃ¢m sÃ ng.',
    pinned: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    title: 'TÃ³m táº¯t SÆ¡ Ä‘á»“ tÆ° duy HÃ³a DÆ°á»£c 2 (KhÃ¡ng sinh & Tim máº¡ch)',
    block: 'ChuyÃªn ngÃ nh DÆ°á»£c',
    category: 'TÃ³m táº¯t lÃ½ thuyáº¿t',
    url: 'https://drive.google.com/drive/folders/newvision-hoaduoc2',
    contributor: 'Tráº§n Minh QuÃ¢n - K77',
    note: 'SÆ¡ Ä‘á»“ cÆ¡ cháº¿ tÃ¡c dá»¥ng, phÃ¢n loáº¡i vÃ  liÃªn quan cáº¥u trÃºc - tÃ¡c dá»¥ng (SAR).',
    pinned: true,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    title: 'Slide bÃ i giáº£ng & CÃ¢u há»i lÆ°á»£ng giÃ¡ Giáº£i pháº«u - Sinh lÃ½',
    block: 'Äáº¡i cÆ°Æ¡ng',
    category: 'Slide bÃ i giáº£ng',
    url: 'https://drive.google.com/drive/folders/newvision-giaiphau',
    contributor: 'Ban ChuyÃªn mÃ´n NVC',
    note: 'Trá»n bá»™ slide giáº£ng Ä‘Æ°á»ng vÃ  ngÃ¢n hÃ ng cÃ¢u há»i Ã´n táº­p giá»¯a ká»³.',
    pinned: false,
    createdAt: new Date().toISOString()
  }
];

const AppCtx = createContext(null);

function AppProvider({children}){
  const[decisions,setDecisions]=useState([]);
  const[events,setEvents]=useState([]);
  const[members,setMembers]=useState([]);
  const[quickChecklist,setQuickChecklist]=useState([]);
  const[quickLinks,setQuickLinks]=useState([]);
  const[notifications,setNotifications]=useState([]);
  const[resources,setResources]=useState([]);
  const[studyResources,setStudyResources]=useState([]);
  const[penalties,setPenalties]=useState([]);
  const[inventory,setInventory]=useState([]);
  const[expenses,setExpenses]=useState([]);
  const[sessions,setSessions]=useState([]);
  const[assignTasks,setAssignTasks]=useState([]);
  const[adminMode,setAdminMode]=useState(false);
  const[userIdentity,setUserIdentity]=useLocalStorage('nv_user_identity','');
  const[clubRules,setClubRules]=useState('');
  const[penaltyAccount,setPenaltyAccount]=useState(null);
  const[loadedTabs,setLoadedTabs]=useState(()=>new Set(['dashboard']));
  const activeUnsubsRef=useRef({});
  const loadTab=useCallback(tab=>{
    if(!tab)return;
    setLoadedTabs(prev=>{
      if(prev.has(tab))return prev;
      const next=new Set(prev);
      next.add(tab);
      return next;
    });
  },[]);
  const[darkMode,setDarkMode]=useLocalStorage('nv_dark',false);
  const[soundEnabled,setSoundEnabled]=useLocalStorage('nv_sound',true);
  const[toasts,setToasts]=useState([]);
  const[mascotState,setMascotState]=useState('idle');
  const[mascotMsg,setMascotMsg]=useState('');
  const mascotTimer=useRef(null);

  const [cloudStatus, setCloudStatus] = useState(fbDb ? 'syncing' : 'offline');
  const [lastSynced, setLastSynced] = useState(null);
  const [pushPermission, setPushPermission] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');

  const[theme,setTheme]=useLocalStorage('nv_theme','orange');
  const[mascotType,setMascotType]=useLocalStorage('nv_mascot_type','vivi');
  const[catEnabled,setCatEnabled]=useLocalStorage('nv_cat_enabled',true);
  const[bcnPin,setBcnPin]=useLocalStorage('nv_bcn_pin','1303');
  useEffect(()=>{
    if(bcnPin==='1337'){
      setBcnPin('1303');
    }
  },[bcnPin,setBcnPin]);
  const[bcnUnlocked,setBcnUnlocked]=useState(false);
  const[bcnNotes,setBcnNotes]=useState({});
  const[bcnPlans,setBcnPlans]=useState([]);
  const[catEvent,setCatEvent]=useState(null);
  const isInitialSnapshotRef=useRef(true);
  const[isInitialSnapshot,setIsInitialSnapshot]=useState(true);

  const triggerCat=useCallback((action,payload=null)=>{
    if(isInitialSnapshotRef.current && (action==='celebrate'||action==='dash')) return;
    setCatEvent({action,payload,id:Date.now()});
  },[]);

  useEffect(()=>{
    document.documentElement.classList.remove('theme-orange','theme-indigo','theme-green');
    document.documentElement.classList.add(`theme-${theme}`);
  },[theme]);

  useEffect(()=>{
    if(darkMode)document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  },[darkMode]);

  const playSound=useCallback((type)=>{
    try{
      if(soundEnabled)window.playSound(type);
    }catch(e){}
  },[soundEnabled]);

  const triggerMascot=useCallback((state,msg='')=>{
    if(isInitialSnapshotRef.current && state==='celebrate') return;
    setMascotState(state);setMascotMsg(msg);
    if(mascotTimer.current)clearTimeout(mascotTimer.current);
    mascotTimer.current=setTimeout(()=>{setMascotState('idle');setMascotMsg('')},2800);
  },[]);

  const showToast=useCallback((message,type='info')=>{
    const id=Date.now()+Math.random();
    setToasts(p=>[...p,{id,message,type,exiting:false}]);
    setTimeout(()=>{setToasts(p=>p.map(t=>t.id===id?{...t,exiting:true}:t));setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),400)},4000);
  },[]);

  const addNotification=useCallback((message,type='info')=>{
    try{
      const n={id:Date.now()+Math.random(),message,type,read:false,timestamp:new Date().toISOString()};
      setNotifications(p=>[n,...p.slice(0,199)]);
      showToast(message,type);
      const pushTitle=type==='error'?'ðŸš¨ BÃO Äá»˜NG SOS - NewVision HUP':type==='success'?'âœ¨ NewVision HUP':type==='warning'?'âš ï¸ NewVision HUP':'ðŸ“¢ NewVision HUP';
      showWebPush(pushTitle,message,{tag:type,requireInteraction:type==='error'});
    }catch(err){
      console.warn('Lá»—i khi thÃªm notification:',err);
    }
  },[showToast]);

  useEffect(()=>{
    window.__dispatchNotification = (msg, t) => {
      try {
        addNotification(msg, t);
      } catch(e) {}
    };
    return () => { window.__dispatchNotification = null; };
  },[addNotification]);

  const requestWebPush=useCallback(async()=>{
    if(typeof window==='undefined'||!('Notification' in window)){
      alert('TrÃ¬nh duyá»‡t cá»§a báº¡n khÃ´ng há»— trá»£ Web Notification.');
      return false;
    }
    try{
      const perm=await Notification.requestPermission();
      setPushPermission(perm);
      if(perm==='granted'){
        showWebPush('ðŸ”” NewVision HUP','ThÃ´ng bÃ¡o Ä‘áº©y Web Push Ä‘Ã£ Ä‘Æ°á»£c kÃ­ch hoáº¡t thÃ nh cÃ´ng!');
        try{playSound('success');}catch(e){}
        showToast('ÄÃ£ báº­t thÃ´ng bÃ¡o Ä‘áº©y Web Push!','success');
        if(fbMessaging&&fbDb){
          try{
            const token=await fbMessaging.getToken();
            if(token){
              await fbDb.collection('nv_fcm_tokens').doc(token.slice(0,32)).set({
                token,
                userAgent:navigator.userAgent,
                updatedAt:firebase.firestore.FieldValue.serverTimestamp()
              },{merge:true});
            }
          }catch(e){
            console.log('FCM token info:',e.message);
          }
        }
        return true;
      }else{
        showToast('Báº¡n Ä‘Ã£ tá»« chá»‘i quyá»n gá»­i thÃ´ng bÃ¡o.','warning');
        return false;
      }
    }catch(e){
      console.warn('requestPermission error:',e);
      return false;
    }
  },[playSound,showToast]);

  // Realtime Firestore LAZY LOAD: Khi vá»«a má»Ÿ trang CHá»ˆ láº¯ng nghe tab Tá»•ng quan (dashboard)
  // Dá»¯ liá»‡u cÃ¡c tab khÃ¡c chá»‰ báº¯t Ä‘áº§u táº£i khi ngÆ°á»i dÃ¹ng click vÃ o tab Ä‘Ã³
  useEffect(()=>{
    if(!fbDb){
      setCloudStatus('offline');
      return;
    }
    setCloudStatus('syncing');

    const listenCol=(colName,setter,sortFn)=>{
      if(activeUnsubsRef.current[colName]) return;
      try{
        let isFirstSnap = true;
        const unsub=fbDb.collection(colName).onSnapshot(snap=>{
          const seenIds = new Set();
          const seenNames = new Set();
          let list = [];

          snap.docs.forEach(d => {
            const data = d.data();
            const id = d.id;
            if (seenIds.has(id)) return;
            seenIds.add(id);

            // Khá»­ trÃ¹ng láº·p cho thÃ nh viÃªn náº¿u cÃ³ báº£n ghi trÃ¹ng
            if (colName === 'members') {
              const nameKey = (data.name || '').trim().toLowerCase() + '|' + (data.ban || '').trim() + '|' + (data.khoa || data.gen || '').trim();
              if (nameKey && seenNames.has(nameKey)) return;
              if (nameKey) seenNames.add(nameKey);
            }

            list.push({ id, ...data });
          });

          if(sortFn) list = sortFn(list);
          setter(list);
          setCloudStatus('connected');
          setLastSynced(new Date());

          if(isFirstSnap){
            isFirstSnap = false;
          }
        },err=>{
          console.error(`Firestore realtime sync error (${colName}):`,err);
          setCloudStatus('offline');
        });
        activeUnsubsRef.current[colName] = unsub;
      }catch(err){
        console.error(`Firestore subscription exception (${colName}):`,err);
        setCloudStatus('offline');
      }
    };

    // 1. CHá»ˆ Táº¢I TAB Tá»”NG QUAN KHI Vá»ªA Má»ž TRANG (Checklist & Quick links):
    listenCol('quickChecklist',setQuickChecklist,list=>list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));
    listenCol('quickLinks',setQuickLinks,list=>list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));

    // 2. LAZY LOAD - CHá»ˆ Táº¢I CÃC TAB KHÃC KHI ÄÆ¯á»¢C KÃCH HOáº T:
    if(loadedTabs.has('events')){
      listenCol('events',setEvents,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
    }
    if(loadedTabs.has('study')){
      listenCol('study_resources',setStudyResources,list=>list.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.createdAt||'').localeCompare(a.createdAt||'')));
    }
    if(loadedTabs.has('members')){
      listenCol('members',setMembers,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
      listenCol('sessions',setSessions,list=>list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));
      listenCol('assignTasks',setAssignTasks,list=>list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));
    }
    if(loadedTabs.has('decisions')){
      listenCol('decisions',setDecisions,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
    }
    if(loadedTabs.has('penalties')){
      listenCol('penalties',setPenalties,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
      if(!activeUnsubsRef.current['penalty_account']){
        try{
          const unsubBank=fbDb.collection('club_settings').doc('penalty_account').onSnapshot(d=>{
            if(d.exists&&d.data()){
              setPenaltyAccount(d.data());
            }
            setCloudStatus('connected');
            setLastSynced(new Date());
          },err=>console.warn('penalty_account sync error:',err));
          activeUnsubsRef.current['penalty_account']=unsubBank;
        }catch(e){}
      }
      if(!activeUnsubsRef.current['club_rules']){
        try{
          const unsubRules=fbDb.collection('club_settings').doc('rules').onSnapshot(d=>{
            if(d.exists&&d.data()?.content!==undefined){
              setClubRules(d.data().content||'');
            }
            setCloudStatus('connected');
            setLastSynced(new Date());
          },err=>console.warn('club_rules sync error:',err));
          activeUnsubsRef.current['club_rules']=unsubRules;
        }catch(e){}
      }
    }
    if(loadedTabs.has('resources')){
      listenCol('resources',setResources,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
      listenCol('inventory',setInventory,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
      listenCol('expenses',setExpenses,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
    }
    if(loadedTabs.has('bcn')){
      listenCol('bcnPlans',setBcnPlans,list=>list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')));
      if(!activeUnsubsRef.current['bcnNotes']){
        try{
          const unsubNotes=fbDb.collection('bcnNotes').doc('general').onSnapshot(d=>{
            if(d.exists&&d.data()?.data){
              setBcnNotes(d.data().data);
            }else{
              setBcnNotes({});
            }
            setCloudStatus('connected');
            setLastSynced(new Date());
          },err=>console.error('bcnNotes sync error:',err));
          activeUnsubsRef.current['bcnNotes']=unsubNotes;
        }catch(e){}
      }
    }
  },[loadedTabs]);

  // Táº£i trÆ°á»›c nháº¹ nhÃ ng sá»‘ liá»‡u tá»•ng quan (events, members, decisions) sau 2.5s khi mÃ¡y ráº£nh
  useEffect(()=>{
    const idleTimer=setTimeout(()=>{
      loadTab('events');
      loadTab('members');
      loadTab('decisions');
    },2500);
    return()=>clearTimeout(idleTimer);
  },[loadTab]);

  // HoÃ£n di chuyá»ƒn dá»¯ liá»‡u cÅ© sau 6s Ä‘á»ƒ trang má»Ÿ tá»©c thÃ¬ dÆ°á»›i 1s
  useEffect(()=>{
    const migTimer=setTimeout(async()=>{
      if(!fbDb)return;
      try{
        const snap=await fbDb.collection('members').limit(1).get();
        if(snap.empty){
          const leg=await fbDb.collection('newvision_hub').doc('members').get();
          if(leg.exists&&Array.isArray(leg.data()?.items)&&leg.data().items.length>0){
            const batch=fbDb.batch();
            leg.data().items.forEach(m=>{
              const id=m.id||uid();
              batch.set(fbDb.collection('members').doc(id),{...m,id});
            });
            await batch.commit();
          }
        }
      }catch(err){}
    },6000);
    return()=>clearTimeout(migTimer);
  },[]);

  useEffect(()=>{
    const initTimer = setTimeout(()=>{
      isInitialSnapshot = false;
      isInitialSnapshotRef.current = false;
      setIsInitialSnapshot(false);
    }, 1200);
    return()=>clearTimeout(initTimer);
  },[]);

  const pushAllToCloud=useCallback(async()=>{
    if(!fbDb){alert('Firebase chÆ°a Ä‘Æ°á»£c khá»Ÿi táº¡o.');return}
    setCloudStatus('syncing');
    try{
      const batch=fbDb.batch();
      members.forEach(m=>batch.set(fbDb.collection('members').doc(m.id||uid()),m,{merge:true}));
      events.forEach(e=>batch.set(fbDb.collection('events').doc(e.id||uid()),e,{merge:true}));
      decisions.forEach(d=>batch.set(fbDb.collection('decisions').doc(d.id||uid()),d,{merge:true}));
      expenses.forEach(x=>batch.set(fbDb.collection('expenses').doc(x.id||uid()),x,{merge:true}));
      resources.forEach(r=>batch.set(fbDb.collection('resources').doc(r.id||uid()),r,{merge:true}));
      studyResources.forEach(s=>batch.set(fbDb.collection('study_resources').doc(s.id||uid()),s,{merge:true}));
      penalties.forEach(p=>batch.set(fbDb.collection('penalties').doc(p.id||uid()),p,{merge:true}));
      inventory.forEach(i=>batch.set(fbDb.collection('inventory').doc(i.id||uid()),i,{merge:true}));
      sessions.forEach(s=>batch.set(fbDb.collection('sessions').doc(s.id||uid()),s,{merge:true}));
      assignTasks.forEach(t=>batch.set(fbDb.collection('assignTasks').doc(t.id||uid()),t,{merge:true}));
      quickChecklist.forEach(c=>batch.set(fbDb.collection('quickChecklist').doc(c.id||uid()),c,{merge:true}));
      quickLinks.forEach(l=>batch.set(fbDb.collection('quickLinks').doc(l.id||uid()),l,{merge:true}));
      bcnPlans.forEach(p=>batch.set(fbDb.collection('bcnPlans').doc(p.id||uid()),p,{merge:true}));
      batch.set(fbDb.collection('bcnNotes').doc('general'),{data:bcnNotes},{merge:true});
      await batch.commit();
      setCloudStatus('connected');
      setLastSynced(new Date());
      try{playSound('success');}catch(e){}
      showToast('ÄÃ£ Ä‘á»“ng bá»™ toÃ n bá»™ dá»¯ liá»‡u lÃªn Cloud Firestore thÃ nh cÃ´ng!','success');
    }catch(err){
      console.error('pushAllToCloud error:',err);
      setCloudStatus('offline');
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  },[members,events,decisions,expenses,resources,studyResources,penalties,inventory,sessions,assignTasks,quickChecklist,quickLinks,bcnPlans,bcnNotes,playSound,showToast]);

  const pullAllFromCloud=useCallback(async()=>{
    if(!fbDb){alert('Firebase chÆ°a Ä‘Æ°á»£c khá»Ÿi táº¡o.');return}
    setCloudStatus('syncing');
    try{
      const[mSnap,eSnap,dSnap,expSnap,rSnap,sResSnap,penSnap,iSnap,sSnap,aSnap,cSnap,lSnap,pSnap,nDoc]=await Promise.all([
        fbDb.collection('members').get(),
        fbDb.collection('events').get(),
        fbDb.collection('decisions').get(),
        fbDb.collection('expenses').get(),
        fbDb.collection('resources').get(),
        fbDb.collection('study_resources').get(),
        fbDb.collection('penalties').get(),
        fbDb.collection('inventory').get(),
        fbDb.collection('sessions').get(),
        fbDb.collection('assignTasks').get(),
        fbDb.collection('quickChecklist').get(),
        fbDb.collection('quickLinks').get(),
        fbDb.collection('bcnPlans').get(),
        fbDb.collection('bcnNotes').doc('general').get(),
      ]);
      setMembers(mSnap.docs.map(d=>({id:d.id,...d.data()})));
      setEvents(eSnap.docs.map(d=>({id:d.id,...d.data()})));
      setDecisions(dSnap.docs.map(d=>({id:d.id,...d.data()})));
      setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})));
      setResources(rSnap.docs.map(d=>({id:d.id,...d.data()})));
      setStudyResources(sResSnap.docs.map(d=>({id:d.id,...d.data()})));
      setPenalties(penSnap.docs.map(d=>({id:d.id,...d.data()})));
      setInventory(iSnap.docs.map(d=>({id:d.id,...d.data()})));
      setSessions(sSnap.docs.map(d=>({id:d.id,...d.data()})));
      setAssignTasks(aSnap.docs.map(d=>({id:d.id,...d.data()})));
      setQuickChecklist(cSnap.docs.map(d=>({id:d.id,...d.data()})));
      setQuickLinks(lSnap.docs.map(d=>({id:d.id,...d.data()})));
      setBcnPlans(pSnap.docs.map(d=>({id:d.id,...d.data()})));
      if(nDoc.exists)setBcnNotes(nDoc.data()?.data||{});
      setCloudStatus('connected');
      setLastSynced(new Date());
      try{playSound('success');}catch(e){}
      showToast('ÄÃ£ táº£i láº¡i toÃ n bá»™ dá»¯ liá»‡u tá»« Cloud Firestore thÃ nh cÃ´ng!','success');
    }catch(err){
      console.error('pullAllFromCloud error:',err);
      setCloudStatus('offline');
      alert('Lá»—i táº£i dá»¯ liá»‡u Firebase: '+err.message);
    }
  },[playSound,showToast]);

  const markRead=useCallback(id=>setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n)),[]);
  const markAllRead=useCallback(()=>setNotifications(p=>p.map(n=>({...n,read:true}))),[]);
  const unreadCount=notifications.filter(n=>!n.read).length;
  const dismissToast=useCallback(id=>{
    setToasts(p=>p.map(t=>t.id===id?{...t,exiting:true}:t));
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),400);
  },[]);

  return(
    <AppCtx.Provider value={{
      decisions,setDecisions,events,setEvents,members,setMembers,
      quickChecklist,setQuickChecklist,quickLinks,setQuickLinks,
      notifications,addNotification,markRead,markAllRead,unreadCount,
      resources,setResources,studyResources,setStudyResources,penalties,setPenalties,inventory,setInventory,expenses,setExpenses,
      sessions,setSessions,assignTasks,setAssignTasks,
      adminMode,setAdminMode,userIdentity,setUserIdentity,clubRules,setClubRules,penaltyAccount,setPenaltyAccount,
      darkMode,setDarkMode,soundEnabled,setSoundEnabled,
      theme,setTheme,mascotType,setMascotType,catEnabled,setCatEnabled,
      bcnPin,setBcnPin,bcnUnlocked,setBcnUnlocked,bcnNotes,setBcnNotes,bcnPlans,setBcnPlans,
      catEvent,triggerCat,
      toasts,dismissToast,mascotState,mascotMsg,triggerMascot,playSound,
      cloudStatus,setCloudStatus,lastSynced,pushPermission,requestWebPush,showWebPush,pushAllToCloud,pullAllFromCloud,
      isInitialSnapshot,loadTab,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

// ============================================================
// TOAST CONTAINER
// ============================================================
function ToastContainer(){
  const{toasts,dismissToast}=useContext(AppCtx);
  const typeStyles={info:'bg-blue-600',success:'bg-emerald-500',warning:'bg-amber-500',error:'bg-red-500'};
  const typeIcons={info:'info',success:'check-circle',warning:'alert-triangle',error:'x-circle'};
  return(
    <div className="fixed bottom-24 md:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map(t=>(
        <div key={t.id} className={`${typeStyles[t.type]||typeStyles.info} ${t.exiting?'toast-exit':'toast-enter'} text-white rounded-xl shadow-2xl px-4 py-3 flex items-start gap-3 pointer-events-auto`}>
          <Icon name={typeIcons[t.type]||'info'} size={18} className="mt-0.5 flex-shrink-0"/>
          <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
          <button onClick={()=>dismissToast(t.id)} className="flex-shrink-0 opacity-80 hover:opacity-100"><Icon name="x" size={14}/></button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MODAL + CONFIRM
// ============================================================
function Modal({open,onClose,title,children,wide}){
  useEffect(()=>{
    if(open)document.body.style.overflow='hidden';
    else document.body.style.overflow='';
    return()=>{document.body.style.overflow=''};
  },[open]);
  if(!open)return null;
  return(
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className={`modal-box slide-down ${wide?'modal-wide':''}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><Icon name="x" size={20} className="text-slate-400"/></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// URL NORMALIZATION & DUPLICATE LINK DETECTION
// ============================================================
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  try {
    let toParse = clean;
    if (!/^https?:\/\//i.test(toParse)) {
      toParse = 'https://' + toParse;
    }
    const parsed = new URL(toParse);
    const trackingParams = [
      'usp', 'fbclid', 'gclid', 'ref', 'source', 'si',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
    ];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    let pathname = parsed.pathname.replace(/\/+$/, '');
    let search = parsed.search ? parsed.search : '';
    let host = parsed.host.toLowerCase().replace(/^www\./, '');
    return (host + pathname + search).toLowerCase();
  } catch (e) {
    return clean
      .replace(/^https?:\/\/(www\.)?/i, '')
      .replace(/[?&](usp|fbclid|utm_[^&=]+)=[^&]*/gi, '')
      .replace(/[?&]$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

async function checkDuplicateLinkAsync(targetUrl, excludeId = null, allData = {}) {
  const normTarget = normalizeUrl(targetUrl);
  if (!normTarget) return null;

  const { studyResources = [], resources = [], events = [] } = allData;

  // 1. Check in studyResources
  for (const item of studyResources) {
    if (item.id && item.id === excludeId) continue;
    if (item.url && normalizeUrl(item.url) === normTarget) {
      return {
        type: 'GÃ³c há»c táº­p',
        title: item.title || 'TÃ i liá»‡u',
        creator: item.contributor || 'ThÃ nh viÃªn CLB',
        rawUrl: item.url
      };
    }
  }

  // 2. Check in resources (links)
  for (const item of resources) {
    if (item.id && item.id === excludeId) continue;
    if (item.url && normalizeUrl(item.url) === normTarget) {
      return {
        type: 'TÃ i nguyÃªn',
        title: item.title || 'LiÃªn káº¿t',
        creator: item.ban ? ('Ban ' + item.ban) : (item.creator || 'Ban Quáº£n trá»‹'),
        rawUrl: item.url
      };
    }
  }

  // 3. Check in events tasks
  for (const ev of events) {
    if (ev.tasks && Array.isArray(ev.tasks)) {
      for (const t of ev.tasks) {
        if (t.id && t.id === excludeId) continue;
        if (t.link && normalizeUrl(t.link) === normTarget) {
          return {
            type: 'Sá»± kiá»‡n: ' + (ev.name || ''),
            title: t.title || 'CÃ´ng viá»‡c',
            creator: t.assignee || 'Ban Tá»• chá»©c',
            rawUrl: t.link
          };
        }
      }
    }
  }

  // 4. Fallback check directly in Firestore if collections were not loaded into memory
  if (typeof fbDb !== 'undefined' && fbDb) {
    try {
      if (!studyResources || studyResources.length === 0) {
        const snap = await fbDb.collection('study_resources').limit(150).get();
        for (const doc of snap.docs) {
          if (doc.id === excludeId) continue;
          const d = doc.data();
          if (d.url && normalizeUrl(d.url) === normTarget) {
            return {
              type: 'GÃ³c há»c táº­p',
              title: d.title || 'TÃ i liá»‡u',
              creator: d.contributor || 'ThÃ nh viÃªn CLB'
            };
          }
        }
      }
      if (!resources || resources.length === 0) {
        const snap = await fbDb.collection('resources').limit(150).get();
        for (const doc of snap.docs) {
          if (doc.id === excludeId) continue;
          const d = doc.data();
          if (d.url && normalizeUrl(d.url) === normTarget) {
            return {
              type: 'TÃ i nguyÃªn',
              title: d.title || 'LiÃªn káº¿t',
              creator: d.ban ? ('Ban ' + d.ban) : 'Ban Quáº£n trá»‹'
            };
          }
        }
      }
    } catch (e) {
      console.warn('Duplicate link query notice:', e);
    }
  }

  return null;
}

function DuplicateLinkDialog({ open, creator, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-100 transform transition-all scale-100">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
          <Icon name="alert-triangle" size={28} />
        </div>
        <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
          Cáº£nh bÃ¡o trÃ¹ng láº·p liÃªn káº¿t
        </h3>
        <p className="text-sm text-center text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          Link nÃ y Ä‘Ã£ tá»“n táº¡i trong há»‡ thá»‘ng (do <span className="font-bold text-amber-600 dark:text-amber-400">{creator || 'ThÃ nh viÃªn CLB'}</span> Ä‘Äƒng). Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n thÃªm láº¡i khÃ´ng?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition text-center"
          >
            Há»§y bá»
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md transition text-center"
          >
            Váº«n lÆ°u
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({open,onClose,onConfirm,message}){
  if(!open)return null;
  return(
    <div className="modal-backdrop">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 slide-down">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><Icon name="alert-triangle" size={20} className="text-red-500"/></div>
          <div><p className="font-semibold text-slate-800">XÃ¡c nháº­n xÃ³a</p><p className="text-sm text-slate-500 mt-0.5">{message}</p></div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Há»§y</button>
          <button onClick={()=>{onConfirm();onClose()}} className="btn-danger">XÃ³a</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MASCOT "Vi Vi" (CÃº MÃ¨o) & "Äáº¡i BÃ ng NewVision"
// ============================================================
function EagleSVG({state}){
  const isSOS=state==='sos';
  const isCelebrate=state==='celebrate';
  const isGavel=state==='gavel';
  const isWrite=state==='write';
  const isWave=state==='wave';
  return(
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
      {isCelebrate&&<circle cx="50" cy="50" r="46" fill="rgba(249,115,22,0.18)"/>}
      <g>
        <path d={isWave?"M28,52 C10,30 6,16 16,12 C26,8 32,30 38,48 Z":isCelebrate?"M30,55 C8,28 2,12 12,6 C22,1 34,24 40,48 Z":"M28,54 C12,40 14,22 24,18 C32,16 36,34 38,50 Z"} fill="#78350f" stroke="#451a03" strokeWidth="1.5"/>
        <path d={isWave?"M28,52 C14,34 12,22 20,18 C28,16 32,34 36,48 Z":isCelebrate?"M30,55 C12,32 8,20 16,14 C24,8 32,28 38,50 Z":"M28,54 C16,42 18,28 26,24 C32,22 35,36 37,50 Z"} fill="#ea580c"/>
        <path d={isCelebrate?"M70,55 C92,28 98,12 88,6 C78,1 66,24 60,48 Z":"M72,54 C88,40 86,22 76,18 C68,16 64,34 62,50 Z"} fill="#78350f" stroke="#451a03" strokeWidth="1.5"/>
        <path d={isCelebrate?"M70,55 C88,32 92,20 84,14 C76,8 68,28 62,50 Z":"M72,54 C84,42 82,28 74,24 C68,22 65,36 63,50 Z"} fill="#ea580c"/>
      </g>
      <ellipse cx="50" cy="72" rx="23" ry="26" fill="#92400e" stroke="#451a03" strokeWidth="1.5"/>
      <path d="M42,58 Q50,78 58,58 Q50,90 42,58 Z" fill="#f59e0b"/>
      <path d="M45,64 Q50,78 55,64" stroke="#d97706" strokeWidth="1.5" fill="none"/>
      <path d="M34,44 C32,20 42,12 50,12 C58,12 68,20 66,44 C64,52 58,56 50,56 C42,56 36,52 34,44 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
      <path d="M46,12 Q50,4 54,12" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M41,14 Q46,7 50,14" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="43" cy="32" r="5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2"/>
      <circle cx="43" cy="32" r="2.5" fill="#0f172a"/>
      <circle cx="41.5" cy="30.5" r="1" fill="#ffffff"/>
      <circle cx="57" cy="32" r="5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2"/>
      <circle cx="57" cy="32" r="2.5" fill="#0f172a"/>
      <circle cx="55.5" cy="30.5" r="1" fill="#ffffff"/>
      <path d="M38,27 L48,31" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M62,27 L52,31" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M46,35 L54,35 L52,49 C50,52 49,50 46,45 Z" fill="#eab308" stroke="#ca8a04" strokeWidth="1.2"/>
      <path d="M45,36 Q50,47 50,50" stroke="#a16207" strokeWidth="1" fill="none"/>
      <g stroke="#ca8a04" strokeWidth="2.5" strokeLinecap="round">
        <line x1="42" y1="98" x2="38" y2="108"/>
        <line x1="45" y1="98" x2="45" y2="109"/>
        <line x1="48" y1="98" x2="51" y2="108"/>
        <line x1="52" y1="98" x2="49" y2="108"/>
        <line x1="55" y1="98" x2="55" y2="109"/>
        <line x1="58" y1="98" x2="62" y2="108"/>
      </g>
      {isSOS&&(
        <g>
          <path d="M33,20 C33,8 67,8 67,20 Z" fill="#ef4444"/>
          <rect x="44" y="4" width="12" height="6" rx="2" fill="#fbbf24"/>
          <text x="50" y="17" textAnchor="middle" fontSize="8" fontWeight="900" fill="white">SOS</text>
        </g>
      )}
      {isCelebrate&&(
        <g>
          <text x="12" y="24" fontSize="14">â­</text>
          <text x="76" y="22" fontSize="14">âœ¨</text>
          <circle cx="50" cy="6" r="4" fill="#fbbf24"/>
          <path d="M42,8 Q50,0 58,8" stroke="#f59e0b" strokeWidth="2" fill="none"/>
        </g>
      )}
      {isGavel&&(
        <g transform="translate(60,26) rotate(35)">
          <rect x="0" y="0" width="28" height="10" rx="3" fill="#92400e"/>
          <rect x="11" y="10" width="6" height="20" rx="2" fill="#78350f"/>
        </g>
      )}
      {isWrite&&(
        <g transform="translate(68,52) rotate(-28)">
          <path d="M0,0 Q10,12 5,28 L0,30 L-2,26 Q2,12 0,0 Z" fill="#fbbf24"/>
        </g>
      )}
    </svg>
  );
}

function ViViSVG({state}){
  const isSOS=state==='sos';
  const isCelebrate=state==='celebrate';
  const isGavel=state==='gavel';
  const isWrite=state==='write';
  return(
    <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
      <ellipse cx="50" cy="92" rx="26" ry="27" fill="#6366f1"/>
      <ellipse cx="50" cy="97" rx="17" ry="19" fill="#a5b4fc"/>
      <circle cx="50" cy="48" r="27" fill="#6366f1"/>
      <polygon points="31,29 21,10 41,23" fill="#4f46e5"/>
      <polygon points="69,29 59,23 79,10" fill="#4f46e5"/>
      <ellipse cx="50" cy="51" rx="21" ry="19" fill="#e0e7ff" opacity="0.75"/>
      <circle cx="40" cy="46" r="11.5" fill="white"/>
      <circle cx="60" cy="46" r="11.5" fill="white"/>
      <circle cx="41" cy="47" r="8" fill="#1e3a5f"/>
      <circle cx="61" cy="47" r="8" fill="#1e3a5f"/>
      <circle cx="40.5" cy="46.5" r="4.5" fill="#0f172a"/>
      <circle cx="60.5" cy="46.5" r="4.5" fill="#0f172a"/>
      <circle cx="38" cy="43.5" r="2.2" fill="white"/>
      <circle cx="58" cy="43.5" r="2.2" fill="white"/>
      <polygon points="50,58 45,65 55,65" fill="#f59e0b"/>
      <ellipse cx="31" cy="58" rx="6" ry="3.5" fill="#f9a8d4" opacity="0.7"/>
      <ellipse cx="69" cy="58" rx="6" ry="3.5" fill="#f9a8d4" opacity="0.7"/>
      <ellipse cx="19" cy="94" rx="13" ry="18" fill="#4f46e5" transform="rotate(17 19 94)"/>
      <ellipse cx="19" cy="94" rx="8" ry="11" fill="#6366f1" opacity="0.5" transform="rotate(17 19 94)"/>
      <ellipse cx="81" cy="94" rx="13" ry="18" fill="#4f46e5" transform="rotate(-17 81 94)"/>
      <ellipse cx="81" cy="94" rx="8" ry="11" fill="#6366f1" opacity="0.5" transform="rotate(-17 81 94)"/>
      <ellipse cx="38" cy="119" rx="11" ry="5.5" fill="#4f46e5"/>
      <ellipse cx="62" cy="119" rx="11" ry="5.5" fill="#4f46e5"/>
      <ellipse cx="30" cy="120" rx="5.5" ry="3.5" fill="#3730a3"/>
      <ellipse cx="38" cy="121.5" rx="5.5" ry="3.5" fill="#3730a3"/>
      <ellipse cx="46" cy="120" rx="5.5" ry="3.5" fill="#3730a3"/>
      <ellipse cx="54" cy="120" rx="5.5" ry="3.5" fill="#3730a3"/>
      <ellipse cx="62" cy="121.5" rx="5.5" ry="3.5" fill="#3730a3"/>
      <ellipse cx="70" cy="120" rx="5.5" ry="3.5" fill="#3730a3"/>
      {isSOS&&(
        <g>
          <ellipse cx="50" cy="28" rx="24" ry="14" fill="#dc2626" opacity="0.92"/>
          <rect x="36" y="17" width="28" height="13" rx="5" fill="#b91c1c"/>
          <rect x="45" y="14" width="10" height="4" rx="2" fill="#fbbf24"/>
          <text x="50" y="28" textAnchor="middle" fontSize="9" fontWeight="900" fill="white" fontFamily="Inter,sans-serif">SOS!</text>
        </g>
      )}
      {isCelebrate&&(
        <g>
          <polygon points="50,7 33,34 67,34" fill="#ec4899"/>
          <polygon points="50,7 33,34 50,28" fill="#db2777"/>
          <circle cx="50" cy="7" r="3.5" fill="#f9a8d4"/>
          <line x1="50" y1="7" x2="49" y2="3.5" stroke="#f9a8d4" strokeWidth="1.5"/>
          <circle cx="49" cy="3" r="2.8" fill="#fbbf24"/>
          <text x="16" y="27" fontSize="13">â­</text>
          <text x="73" y="23" fontSize="11">âœ¨</text>
        </g>
      )}
      {isGavel&&(
        <g transform="translate(58,28) rotate(35)">
          <rect x="0" y="0" width="30" height="11" rx="4" fill="#92400e"/>
          <rect x="12" y="11" width="7" height="22" rx="2.5" fill="#78350f"/>
          <rect x="0" y="2" width="30" height="5" rx="2" fill="#a16207" opacity="0.5"/>
        </g>
      )}
      {isWrite&&(
        <g transform="translate(66,58) rotate(-28)">
          <rect x="0" y="0" width="7" height="24" rx="2.5" fill="#fbbf24"/>
          <polygon points="0,24 7,24 3.5,31" fill="#1e293b"/>
          <rect x="-1" y="0" width="9" height="5" rx="2" fill="#ef4444"/>
          <rect x="3" y="5" width="1.5" height="8" fill="#e5e7eb"/>
        </g>
      )}
    </svg>
  );
}

function Mascot(){
  const[mounted,setMounted]=useState(false);
  useEffect(()=>{
    const t=setTimeout(()=>setMounted(true),1000);
    return()=>clearTimeout(t);
  },[]);
  const{mascotState,mascotMsg,triggerMascot,playSound,events,mascotType,isInitialSnapshot}=useContext(AppCtx);
  const[showBubble,setShowBubble]=useState(false);
  const[bubText,setBubText]=useState('');

  const allTasks=useMemo(()=>events.flatMap(e=>e.tasks||[]),[events]);
  const energy=allTasks.length>0?Math.round(allTasks.filter(t=>t.done).length/allTasks.length*100):0;

  useEffect(()=>{
    if(mascotState==='celebrate'){
      if(!isInitialSnapshot && window.confetti){
        try{
          window.confetti({particleCount:30,spread:50,origin:{x:.88,y:.9},colors:['#f97316','#ea580c','#6366f1','#ec4899','#f59e0b','#10b981'],ticks:90});
          setTimeout(()=>{
            try{if(window.confetti&&typeof window.confetti.reset==='function')window.confetti.reset();}catch(e){}
          },1500);
        }catch(e){}
      }
      try{playSound('success');}catch(e){}
    }else if(mascotState==='sos'){try{playSound('sos');}catch(e){}}
    else if(mascotState==='gavel'){try{playSound('gavel');}catch(e){}}
    else if(mascotState==='wave'){try{playSound('pop');}catch(e){}}
    if(mascotMsg){setShowBubble(true);setBubText(mascotMsg)}
    else{setTimeout(()=>setShowBubble(false),200)}
  },[mascotState,mascotMsg,playSound]);

  const handleClick=()=>{
    const list=mascotType==='eagle'?EAGLE_MESSAGES:MASCOT_MESSAGES;
    const msg=list[Math.floor(Math.random()*list.length)];
    triggerMascot('wave',msg);
  };

  if(!mounted) return null;
  const stateClass={idle:'mascot-idle',wave:'mascot-wave',celebrate:'mascot-celebrate',sos:'mascot-sos',gavel:'mascot-gavel',write:'mascot-write'}[mascotState]||'mascot-idle';
  const mascotTitle=mascotType==='eagle'?'Äáº¡i bÃ ng NewVision â€“ Báº¥m Ä‘á»ƒ nháº­n lá»i cá»• vÅ©!':'Vi Vi â€“ Báº¥m Ä‘á»ƒ nháº­n lá»i cá»• vÅ©!';

  return(
    <div className="mascot-container fixed bottom-20 right-3 md:bottom-8 z-[80] flex flex-col items-center gap-1 select-none">
      {showBubble&&bubText&&(
        <div className="mascot-bubble relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl rounded-br-sm px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 shadow-xl max-w-[175px] text-center bubble-pop mb-1">
          {bubText}
        </div>
      )}
      <div className={`w-16 h-20 cursor-pointer ${stateClass}`} onClick={handleClick} title={mascotTitle}>
        {mascotType==='eagle'?<EagleSVG state={mascotState}/>:<ViViSVG state={mascotState}/>}
      </div>
      <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-indigo-500 transition-all duration-1000" style={{width:`${energy}%`}}/>
      </div>
      <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center">âš¡ {energy}% NL CLB</p>
    </div>
  );
}

// ============================================================
// SCREEN CAT COMPANION (Desktop Pet / Game Companion)
// ============================================================
function ScreenCatCompanion(){
  const[mounted,setMounted]=useState(false);
  useEffect(()=>{
    const t=setTimeout(()=>setMounted(true),1200);
    return()=>clearTimeout(t);
  },[]);
  const{catEnabled,catEvent,playSound}=useContext(AppCtx);
  const[pos,setPos]=useState({x:120,y:window.innerHeight-52});
  const[state,setState]=useState('idle');
  const[facing,setFacing]=useState(1);
  const[speech,setSpeech]=useState('');
  const[sparks,setSparks]=useState([]);
  const[isBlinking,setIsBlinking]=useState(false);

  const isPointerDownRef=useRef(false);
  const hasDraggedRef=useRef(false);
  const justFinishedDragRef=useRef(false);
  const dragStartRef=useRef({x:0,y:0});
  const dragOffsetRef=useRef({x:0,y:0});
  const targetXRef=useRef(120);
  const vyRef=useRef(0);
  const speechTimerRef=useRef(null);
  const lastInteractionTimeRef=useRef(Date.now());
  const lastUserActivityRef=useRef(Date.now());
  const lastClickTimeRef=useRef(0);

  const getFloorY=useCallback(()=>{
    return window.innerWidth<768?window.innerHeight-108:window.innerHeight-52;
  },[]);

  const showCatSpeech=useCallback((text,duration=1500)=>{
    setSpeech(text);
    if(speechTimerRef.current)clearTimeout(speechTimerRef.current);
    speechTimerRef.current=setTimeout(()=>setSpeech(''),duration);
  },[]);

  // Láº¯ng nghe thao tÃ¡c ngÆ°á»i dÃ¹ng toÃ n trang: sau 20s khÃ´ng cháº¡m web, mÃ¨o tá»± Ä‘á»™ng ngá»§
  useEffect(()=>{
    if(!catEnabled)return;
    const onUserAct=()=>{
      lastUserActivityRef.current=Date.now();
      setState(s=>(s==='sleep'?'idle':s));
    };
    window.addEventListener('mousemove',onUserAct,{passive:true});
    window.addEventListener('keydown',onUserAct,{passive:true});
    window.addEventListener('scroll',onUserAct,{passive:true});
    window.addEventListener('touchstart',onUserAct,{passive:true});
    return()=>{
      window.removeEventListener('mousemove',onUserAct);
      window.removeEventListener('keydown',onUserAct);
      window.removeEventListener('scroll',onUserAct);
      window.removeEventListener('touchstart',onUserAct);
    };
  },[catEnabled]);

  // Sá»± kiá»‡n kÃ­ch hoáº¡t tá»« há»‡ thá»‘ng (khi hoÃ n thÃ nh task hoáº·c sá»± kiá»‡n Ä‘áº·c biá»‡t)
  useEffect(()=>{
    if(!catEnabled||!catEvent)return;
    if(catEvent.action==='dash'){
      setState('dash');
      setFacing(1);
      showCatSpeech('VÃ¨o vÃ¨o~! ðŸš€ðŸ¾',1500);
      try{playSound('pop');}catch(e){}
      const newSparks=Array.from({length:6},(_,i)=>({
        id:Date.now()+i,x:Math.random()*40-20,y:Math.random()*20-10,emoji:['âœ¨','â­','ðŸ’«'][i%3]
      }));
      setSparks(newSparks);
      setTimeout(()=>setSparks([]),1500);
      setTimeout(()=>setState('idle'),1600);
    }else if(catEvent.action==='celebrate'){
      setState('celebrate');
      try{playSound('success');}catch(e){}
      showCatSpeech('Hoan hÃ´! Xong viá»‡c rá»“i! ðŸŽ‰ðŸ±',1500);
      if(window.confetti){
        try{
          window.confetti({
            particleCount:30,
            spread:60,
            origin:{x:Math.min(Math.max(pos.x/window.innerWidth,0.1),0.9),y:Math.min(pos.y/window.innerHeight,0.9)},
            ticks:100
          });
          setTimeout(()=>{
            try{if(window.confetti&&typeof window.confetti.reset==='function')window.confetti.reset();}catch(e){}
          },1500);
        }catch(e){}
      }
      setTimeout(()=>setState('idle'),1200);
    }
  },[catEvent,catEnabled,playSound,showCatSpeech,pos.x,pos.y]);

  useEffect(()=>{
    if(!catEnabled)return;
    const handleResize=()=>{
      setPos(p=>({x:Math.min(p.x,window.innerWidth-60),y:getFloorY()}));
    };
    window.addEventListener('resize',handleResize);
    return()=>window.removeEventListener('resize',handleResize);
  },[catEnabled,getFloorY]);

  // Xá»­ lÃ½ kÃ©o tháº£ (Pointer move / Pointer up)
  useEffect(()=>{
    if(!catEnabled)return;
    const handlePointerMove=e=>{
      if(!isPointerDownRef.current)return;
      const clientX=e.clientX??e.touches?.[0]?.clientX;
      const clientY=e.clientY??e.touches?.[0]?.clientY;
      if(clientX===undefined||clientY===undefined)return;

      const dist=Math.hypot(clientX-dragStartRef.current.x,clientY-dragStartRef.current.y);
      // Náº¿u di chuyá»ƒn quÃ¡ 6px, xÃ¡c Ä‘á»‹nh Ä‘Ã¢y lÃ  hÃ nh Ä‘á»™ng kÃ©o (drag) chá»© KHÃ”NG PHáº¢I click
      if(dist>6){
        hasDraggedRef.current=true;
        setState('drag');
        const newX=Math.max(10,Math.min(window.innerWidth-60,clientX-dragOffsetRef.current.x));
        const newY=Math.max(10,Math.min(window.innerHeight-30,clientY-dragOffsetRef.current.y));
        setPos({x:newX,y:newY});
      }
    };

    const handlePointerUp=()=>{
      if(!isPointerDownRef.current)return;
      isPointerDownRef.current=false;
      const now=Date.now();
      lastUserActivityRef.current=now;

      if(hasDraggedRef.current){
        // ÄÃ¡nh dáº¥u vá»«a kÃ©o tháº£ Ä‘á»ƒ cháº·n sá»± kiá»‡n click chuá»™t Äƒn theo
        justFinishedDragRef.current=true;
        setTimeout(()=>{justFinishedDragRef.current=false},250);

        // Tháº£ mÃ¨o á»Ÿ Ä‘Ã¢u thÃ¬ cho phÃ©p mÃ¨o Ä‘á»©ng á»Ÿ Ä‘Ã³ má»™t lÃ¡t (15 giÃ¢y khÃ´ng tá»± Ä‘á»™ng Ä‘i dáº¡o)
        lastInteractionTimeRef.current=now;

        const floorY=getFloorY();
        if(pos.y<floorY-15){
          setState('fall');
          vyRef.current=0;
        }else{
          setPos(p=>({...p,y:floorY}));
          setState('idle');
        }
        // TUYá»†T Äá»I KHÃ”NG kÃ­ch hoáº¡t hiá»‡u á»©ng phÃ¡o hoa hay chÃºc má»«ng khi ngÆ°á»i dÃ¹ng vá»«a kÃ©o tháº£ mÃ¨o xong
      }
    };

    window.addEventListener('mousemove',handlePointerMove);
    window.addEventListener('mouseup',handlePointerUp);
    window.addEventListener('touchmove',handlePointerMove,{passive:false});
    window.addEventListener('touchend',handlePointerUp);
    return()=>{
      window.removeEventListener('mousemove',handlePointerMove);
      window.removeEventListener('mouseup',handlePointerUp);
      window.removeEventListener('touchmove',handlePointerMove);
      window.removeEventListener('touchend',handlePointerUp);
    };
  },[catEnabled,getFloorY,pos.y]);

  // Hiá»‡u á»©ng rÆ¡i bung dÃ¹ khi tháº£ tá»« trÃªn cao
  useEffect(()=>{
    if(!catEnabled||state!=='fall')return;
    let animId;
    const floorY=getFloorY();
    const loop=()=>{
      setPos(p=>{
        const nextVy=Math.min(vyRef.current+0.35,4.2);
        vyRef.current=nextVy;
        const nextY=p.y+nextVy;
        if(nextY>=floorY){
          vyRef.current=0;
          setState('landing');
          try{playSound('pop');}catch(e){}
          setTimeout(()=>setState('idle'),400);
          return{x:p.x,y:floorY};
        }
        return{x:p.x,y:nextY};
      });
      animId=requestAnimationFrame(loop);
    };
    animId=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animId);
  },[catEnabled,state,getFloorY,playSound]);

  // VÃ²ng láº·p hÃ nh vi tá»± nhiÃªn: 20s idle ngá»§, 10s sau tháº£ má»›i Ä‘i dáº¡o, quay láº¡i lá» an toÃ n
  useEffect(()=>{
    if(!catEnabled)return;
    const interval=setInterval(()=>{
      if(isPointerDownRef.current||state==='fall'||state==='drag'||state==='dash'||state==='celebrate'||state==='landing'||state==='bounce')return;
      const now=Date.now();

      // Tráº¡ng thÃ¡i nhÃ n rá»—i (Idle): Khi ngÆ°á»i dÃ¹ng khÃ´ng cháº¡m vÃ o web 20 giÃ¢y, mÃ¨o tá»± Ä‘á»™ng chuyá»ƒn tÆ° tháº¿ náº±m ngá»§
      if(now-lastUserActivityRef.current>=20000){
        if(state!=='sleep')setState('sleep');
        return;
      }

      // Sau 15 giÃ¢y khÃ´ng tÆ°Æ¡ng tÃ¡c: tá»± Ä‘á»™ng Ä‘Æ°a mÃ¨o vá» gÃ³c lá» an toÃ n
      if(now-lastInteractionTimeRef.current>=15000){
        const isNearLeft=pos.x<100;
        const isNearRight=pos.x>window.innerWidth-120;
        if(!isNearLeft&&!isNearRight){
          const safeX=pos.x>window.innerWidth/2?window.innerWidth-85:40;
          targetXRef.current=safeX;
          setFacing(safeX>pos.x?1:-1);
          setState('walk');
          lastInteractionTimeRef.current=now;
          return;
        }
      }

      // Tháº£ mÃ¨o á»Ÿ Ä‘Ã¢u thÃ¬ Ä‘á»©ng yÃªn 15 giÃ¢y trÆ°á»›c khi tá»± Ä‘á»™ng Ä‘i dáº¡o
      if(now-lastInteractionTimeRef.current<15000)return;

      // Náº¿u náº±m sÃ¡t viá»n quÃ¡ (lá» trÃ¡i < 25px hoáº·c lá» pháº£i > width - 75px), quay láº¡i lá» an toÃ n
      if(pos.x<25||pos.x>window.innerWidth-75){
        const safeX=pos.x<25?70:window.innerWidth-120;
        targetXRef.current=safeX;
        setFacing(safeX>pos.x?1:-1);
        setState('walk');
        return;
      }

      // Äi dáº¡o nháº¹ nhÃ ng thong tháº£
      const r=Math.random();
      if(r<0.28){
        const delta=(Math.random()*70+30)*(Math.random()>0.5?1:-1);
        const newX=Math.max(30,Math.min(window.innerWidth-80,pos.x+delta));
        targetXRef.current=newX;
        setFacing(newX>pos.x?1:-1);
        setState('walk');
      }else if(r<0.65){
        setState('idle');
      }else if(r<0.85){
        setState('lick');
      }
    },3600);
    return()=>clearInterval(interval);
  },[catEnabled,state,pos.x]);

  // BÆ°á»›c chÃ¢n khi Ä‘i dáº¡o
  useEffect(()=>{
    if(!catEnabled||state!=='walk')return;
    let animId;
    const step=()=>{
      setPos(p=>{
        const dx=targetXRef.current-p.x;
        if(Math.abs(dx)<3){
          setState('idle');
          return p;
        }
        const speed=1.4;
        return{...p,x:p.x+(dx>0?speed:-speed)};
      });
      animId=requestAnimationFrame(step);
    };
    animId=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(animId);
  },[catEnabled,state]);

  const handlePointerStart=e=>{
    const clientX=e.clientX??e.touches?.[0]?.clientX;
    const clientY=e.clientY??e.touches?.[0]?.clientY;
    if(clientX===undefined||clientY===undefined)return;

    isPointerDownRef.current=true;
    hasDraggedRef.current=false;
    dragStartRef.current={x:clientX,y:clientY};
    dragOffsetRef.current={x:clientX-pos.x,y:clientY-pos.y};
  };

  // Xá»­ lÃ½ CLICK CHá»¦ Äá»˜NG vÃ o chÃº mÃ¨o
  const handleClick=()=>{
    // Náº¿u di chuyá»ƒn quÃ¡ 6px hoáº·c vá»«a kÃ©o tháº£ xong thÃ¬ KHÃ”NG PHáº¢I click
    if(hasDraggedRef.current||justFinishedDragRef.current)return;

    const now=Date.now();
    lastUserActivityRef.current=now;
    lastInteractionTimeRef.current=now;

    if(state==='sleep'){
      setState('idle');
    }

    // Cá» chá»‘ng spam (cooldown 3 giÃ¢y): Náº¿u báº¥m liÃªn tá»¥c chá»‰ nháº¥p nhÃ¡y máº¯t, khÃ´ng nháº£y chá»¯ dá»“n dáº­p
    if(now-lastClickTimeRef.current<3000){
      setIsBlinking(true);
      setTimeout(()=>setIsBlinking(false),350);
      return;
    }
    lastClickTimeRef.current=now;

    // Tuyá»‡t Ä‘á»‘i KHÃ”NG báº¯n phÃ¡o hoa confetti toÃ n mÃ n hÃ¬nh
    // Pháº£n há»“i ngáº«u nhiÃªn 1 trong cÃ¡c hÃ nh Ä‘á»™ng dá»… thÆ°Æ¡ng:
    const choice=Math.floor(Math.random()*3);
    if(choice===0){
      // 1. KÃªu "Meow! ðŸ¾" nháº¹ kÃ¨m Ã¢m thanh nhá»
      try{playSound('pop');}catch(e){}
      showCatSpeech('Meow! ðŸ¾',1500);
    }else if(choice===1){
      // 2. Nháº£y dá»±ng lÃªn nháº¹ (hiá»‡u á»©ng bounce/nhÃºn chÃ¢n 0.3s)
      try{playSound('pop');}catch(e){}
      setState('bounce');
      setTimeout(()=>setState('idle'),320);
      showCatSpeech('Boing! ðŸ¾ Cá»‘ lÃªn nhÃ©!',1500);
    }else{
      // 3. Hiá»‡n bÃ³ng thoáº¡i ngáº¯n 1.5s tá»± biáº¿n máº¥t
      const msgs=[
        'Cá»‘ lÃªn NVC! ðŸ”¥',
        'Táº­p trung há»c táº­p nhÃ©! ðŸ“š',
        'NewVision Ä‘á»‰nh nÃ³c ká»‹ch tráº§n! âœ¨',
        'Nghá»‰ ngÆ¡i uá»‘ng nÆ°á»›c nhÃ©! ðŸµ'
      ];
      const msg=msgs[Math.floor(Math.random()*msgs.length)];
      try{playSound('pop');}catch(e){}
      showCatSpeech(msg,1500);
    }
  };

  // Click Ä‘Ãºp (double click) vÃ o mÃ¨o Ä‘á»ƒ quay vá» vá»‹ trÃ­ ban Ä‘áº§u
  const handleDoubleClick=e=>{
    if(e&&e.stopPropagation)e.stopPropagation();
    const floorY=getFloorY();
    setPos({x:120,y:floorY});
    setState('idle');
    setFacing(1);
    showCatSpeech('Meow~! ðŸ± Vá» chá»— cÅ© rá»“i!',1500);
    try{playSound('pop');}catch(e){}
  };

  if(!mounted||!catEnabled)return null;

  const isSleep=state==='sleep';
  const isLick=state==='lick';
  const isDrag=state==='drag';
  const isFall=state==='fall';
  const isLanding=state==='landing';
  const isCelebrate=state==='celebrate';
  const isBounce=state==='bounce';

  return(
    <div
      className="screen-cat-companion fixed z-[95] pointer-events-auto select-none transition-transform duration-75"
      style={{
        left:`${pos.x}px`,
        top:`${pos.y}px`,
        transform:`scaleX(${facing}) ${isLanding?'scale(1.25, 0.7)':''}`,
        cursor:isDrag?'grabbing':'grab',
        touchAction:'none'
      }}
      onMouseDown={handlePointerStart}
      onTouchStart={handlePointerStart}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title="BÃ© mÃ¨o NewVision â€“ KÃ©o tháº£ hoáº·c click Ä‘á»ƒ chÆ¡i Ä‘Ã¹a, click Ä‘Ãºp Ä‘á»ƒ vá» chá»— cÅ©!"
    >
      {speech&&(
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-orange-200 dark:border-slate-700 pointer-events-none bubble-pop"
          style={{transform:`scaleX(${facing})`}}
        >
          {speech}
        </div>
      )}
      {isSleep&&(
        <div className="absolute -top-7 -right-1 text-[11px] font-black text-indigo-500 pointer-events-none" style={{animation:'catSleepZ 2s infinite ease-out'}}>
          z Z z
        </div>
      )}
      {isFall&&(
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none" style={{animation:'parachuteSway 1.2s infinite ease-in-out'}}>
          <svg width="48" height="28" viewBox="0 0 48 28">
            <path d="M4,20 C4,4 44,4 44,20 Z" fill="#ea580c"/>
            <path d="M14,20 C14,6 34,6 34,20 Z" fill="#f97316"/>
            <path d="M20,20 C20,8 28,8 28,20 Z" fill="#ffedd5"/>
            <line x1="6" y1="20" x2="24" y2="28" stroke="#94a3b8" strokeWidth="1"/>
            <line x1="20" y1="20" x2="24" y2="28" stroke="#94a3b8" strokeWidth="1"/>
            <line x1="28" y1="20" x2="24" y2="28" stroke="#94a3b8" strokeWidth="1"/>
            <line x1="42" y1="20" x2="24" y2="28" stroke="#94a3b8" strokeWidth="1"/>
          </svg>
        </div>
      )}
      {sparks.map(s=>(
        <span key={s.id} className="absolute text-sm pointer-events-none" style={{left:`${s.x}px`,top:`${s.y}px`,animation:'dashSparkle 1s forwards'}}>
          {s.emoji}
        </span>
      ))}
      <div className={`w-12 h-10 ${isCelebrate?'cat-flip-anim':isLanding?'cat-landing-anim':isBounce?'cat-bounce-anim':''}`}>
        <svg viewBox="0 0 52 44" className="w-full h-full drop-shadow-md overflow-visible">
          <path
            d={isSleep?"M6,32 Q12,38 20,36":isDrag?"M8,36 Q8,44 14,42":"M8,26 Q2,16 6,8"}
            fill="none" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round"
            style={{transformOrigin:'8px 26px',animation:isSleep?'none':'catTail 1.4s infinite ease-in-out'}}
          />
          <ellipse cx="24" cy="27" rx="14" ry="11" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8"/>
          <path d="M16,18 Q24,14 28,22 Q24,32 14,28 Z" fill="#ea580c"/>
          <path d="M28,20 Q34,18 36,26 Q30,30 26,24 Z" fill="#f97316"/>
          <circle cx="34" cy="18" r="10.5" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8"/>
          <path d="M28,10 Q34,8 38,14 Q30,16 28,10 Z" fill="#ea580c"/>
          <polygon points="27,11 25,2 32,7" fill="#ea580c"/>
          <polygon points="27,9 26,4 30,7" fill="#f472b6"/>
          <polygon points="36,7 42,2 41,11" fill="#ea580c"/>
          <polygon points="38,7 41,4 40,9" fill="#f472b6"/>
          {isSleep||isBlinking?(
            <g stroke="#334155" strokeWidth="1.2" strokeLinecap="round" fill="none">
              <path d="M31,18 Q33,16 35,18"/>
              <path d="M38,18 Q40,16 42,18"/>
            </g>
          ):isDrag?(
            <g>
              <circle cx="33" cy="17" r="3" fill="#0f172a"/>
              <circle cx="39" cy="17" r="3" fill="#0f172a"/>
              <circle cx="32" cy="16" r="1" fill="#ffffff"/>
              <circle cx="38" cy="16" r="1" fill="#ffffff"/>
            </g>
          ):(
            <g>
              <ellipse cx="33" cy="17" rx="2.4" ry="2.8" fill="#0f172a"/>
              <ellipse cx="39" cy="17" rx="2.4" ry="2.8" fill="#0f172a"/>
              <circle cx="32.2" cy="16" r="0.9" fill="#ffffff"/>
              <circle cx="38.2" cy="16" r="0.9" fill="#ffffff"/>
            </g>
          )}
          <polygon points="36,20 35,21.5 37,21.5" fill="#f472b6"/>
          <path d="M34,22 Q35,23.5 36,22 Q37,23.5 38,22" fill="none" stroke="#64748b" strokeWidth="0.9" strokeLinecap="round"/>
          <line x1="28" y1="18" x2="23" y2="17" stroke="#cbd5e1" strokeWidth="0.8"/>
          <line x1="28" y1="20" x2="22" y2="21" stroke="#cbd5e1" strokeWidth="0.8"/>
          <line x1="43" y1="18" x2="48" y2="17" stroke="#cbd5e1" strokeWidth="0.8"/>
          <line x1="43" y1="20" x2="49" y2="21" stroke="#cbd5e1" strokeWidth="0.8"/>
          {isDrag?(
            <g fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8">
              <ellipse cx="20" cy="39" rx="2.5" ry="4"/>
              <ellipse cx="28" cy="39" rx="2.5" ry="4"/>
              <ellipse cx="35" cy="39" rx="2.5" ry="4"/>
            </g>
          ):isLick?(
            <g fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8">
              <ellipse cx="18" cy="36" rx="3" ry="2.2"/>
              <ellipse cx="25" cy="36" rx="3" ry="2.2"/>
              <ellipse cx="34" cy="23" rx="2.5" ry="3.5" transform="rotate(-20 34 23)" fill="#ffffff"/>
            </g>
          ):(
            <g fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8">
              <ellipse cx="16" cy="36" rx="3.5" ry="2.2" style={{animation:state==='walk'?'catPawWalk 0.3s infinite alternate':'none'}}/>
              <ellipse cx="24" cy="36" rx="3.2" ry="2.2"/>
              <ellipse cx="32" cy="36" rx="3.2" ry="2.2" style={{animation:state==='walk'?'catPawWalk 0.3s infinite alternate-reverse':'none'}}/>
              <ellipse cx="38" cy="36" rx="3.2" ry="2.2"/>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS MODAL
// ============================================================
function SettingsModal({open,onClose}){
  const{
    theme,setTheme,mascotType,setMascotType,catEnabled,setCatEnabled,soundEnabled,setSoundEnabled,
    decisions,events,members,sessions,assignTasks,quickChecklist,quickLinks,
    resources,inventory,expenses,notifications,
    setDecisions,setEvents,setMembers,setSessions,setAssignTasks,setQuickChecklist,setQuickLinks,
    setResources,setInventory,setExpenses,addNotification,playSound,
    cloudStatus,lastSynced,pushPermission,requestWebPush,pushAllToCloud,pullAllFromCloud,showWebPush
  }=useContext(AppCtx);

  const fileInputRef=useRef(null);

  const handleExport=()=>{
    exportJSON({
      exportedAt:new Date().toISOString(),version:'2.5',clb:'NewVision HUP â€“ CLB Ká»¹ nÄƒng má»m ÄH DÆ°á»£c HN',
      decisions,events,members,sessions,assignTasks,quickChecklist,quickLinks,
      resources,inventory,expenses,notifications:notifications.slice(0,100),
    },`newvision-hup-${new Date().toISOString().slice(0,10)}.json`);
    try{playSound('success');}catch(e){}
    try{addNotification('ðŸ“¦ ÄÃ£ xuáº¥t backup dá»¯ liá»‡u thÃ nh cÃ´ng!','success');}catch(e){}
  };

  const handleImport=e=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=async ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(!fbDb){
          alert('Lá»—i lÆ°u Firebase: ChÆ°a káº¿t ná»‘i Ä‘Æ°á»£c Firebase Firestore!');
          return;
        }
        const batch=fbDb.batch();
        if(Array.isArray(d.members))d.members.forEach(m=>batch.set(fbDb.collection('members').doc(m.id||uid()),m,{merge:true}));
        if(Array.isArray(d.events))d.events.forEach(e=>batch.set(fbDb.collection('events').doc(e.id||uid()),e,{merge:true}));
        if(Array.isArray(d.decisions))d.decisions.forEach(x=>batch.set(fbDb.collection('decisions').doc(x.id||uid()),x,{merge:true}));
        if(Array.isArray(d.expenses))d.expenses.forEach(x=>batch.set(fbDb.collection('expenses').doc(x.id||uid()),x,{merge:true}));
        if(Array.isArray(d.resources))d.resources.forEach(r=>batch.set(fbDb.collection('resources').doc(r.id||uid()),r,{merge:true}));
        if(Array.isArray(d.inventory))d.inventory.forEach(i=>batch.set(fbDb.collection('inventory').doc(i.id||uid()),i,{merge:true}));
        if(Array.isArray(d.sessions))d.sessions.forEach(s=>batch.set(fbDb.collection('sessions').doc(s.id||uid()),s,{merge:true}));
        if(Array.isArray(d.assignTasks))d.assignTasks.forEach(t=>batch.set(fbDb.collection('assignTasks').doc(t.id||uid()),t,{merge:true}));
        if(Array.isArray(d.quickChecklist))d.quickChecklist.forEach(c=>batch.set(fbDb.collection('quickChecklist').doc(c.id||uid()),c,{merge:true}));
        if(Array.isArray(d.quickLinks))d.quickLinks.forEach(l=>batch.set(fbDb.collection('quickLinks').doc(l.id||uid()),l,{merge:true}));
        if(Array.isArray(d.bcnPlans))d.bcnPlans.forEach(p=>batch.set(fbDb.collection('bcnPlans').doc(p.id||uid()),p,{merge:true}));
        if(d.bcnNotes&&typeof d.bcnNotes==='object')batch.set(fbDb.collection('bcnNotes').doc('general'),{data:d.bcnNotes},{merge:true});
        await batch.commit();
        try{playSound('success');}catch(e){}
        try{addNotification('âœ… Nháº­p dá»¯ liá»‡u backup lÃªn Cloud Firestore thÃ nh cÃ´ng!','success');}catch(e){}
        onClose();
      }catch(err){
        console.error('Import error:',err);
        alert('Lá»—i lÆ°u Firebase: '+err.message);
      }
    };
    reader.readAsText(file);
    e.target.value='';
  };

  return(
    <Modal open={open} onClose={onClose} title="CÃ i Äáº·t Há»‡ Thá»‘ng & Giao Diá»‡n" wide>
      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">ðŸŽ¨ TÃ¹y chá»n Theme mÃ u chá»§ Ä‘áº¡o</label>
          <div className="grid sm:grid-cols-3 gap-3">
            {COLOR_THEMES.map(t=>(
              <div
                key={t.id}
                onClick={()=>{setTheme(t.id);try{playSound('pop');}catch(e){}}}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${theme===t.id?'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm':'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full shadow-inner flex items-center justify-center text-white text-[10px]" style={{background:t.c1}}>âœ“</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{t.name}</span>
                  </div>
                  {theme===t.id&&<span className="text-[10px] bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-full">Äang dÃ¹ng</span>}
                </div>
                <div className="h-2 rounded-full mb-2" style={{background:`linear-gradient(90deg, ${t.c1}, ${t.c2})`}}/>
                <p className="text-[11px] text-slate-400 leading-snug">{t.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">ðŸ¦‰ TÃ¹y chá»n Linh váº­t CLB</label>
          <div className="grid sm:grid-cols-2 gap-3">
            {MASCOT_TYPES.map(m=>(
              <div
                key={m.id}
                onClick={()=>{setMascotType(m.id);try{playSound('pop');}catch(e){}}}
                className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-all ${mascotType===m.id?'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm':'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{m.name}</span>
                    {mascotType===m.id&&<span className="text-[10px] bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-full">Äang dÃ¹ng</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="card p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ðŸ±</span>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">BÃ© MÃ¨o Cháº¡y MÃ n HÃ¬nh</p>
                <p className="text-[11px] text-slate-400">Pet áº£o xáº£ stress, kÃ©o tháº£ vÃ  vá»n chuá»™t</p>
              </div>
            </div>
            <button
              onClick={()=>{setCatEnabled(v=>!v);try{playSound('pop');}catch(e){}}}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${catEnabled?'bg-orange-500':'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${catEnabled?'translate-x-6':''}`}/>
            </button>
          </div>

          <div className="card p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ðŸ”Š</span>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Ã‚m Thanh Hiá»‡u á»¨ng</p>
                <p className="text-[11px] text-slate-400">Ã‚m thanh vui tai khi chá»‘t viá»‡c & SOS</p>
              </div>
            </div>
            <button
              onClick={()=>{setSoundEnabled(v=>!v);try{playSound('pop');}catch(e){}}}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${soundEnabled?'bg-orange-500':'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${soundEnabled?'translate-x-6':''}`}/>
            </button>
          </div>
        </div>

        {/* FIREBASE REALTIME COMPACT STATUS */}
        <div className="card p-4 border border-blue-200 dark:border-blue-900/50 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tráº¡ng thÃ¡i: <span className="font-bold text-emerald-600 dark:text-emerald-400">â— ÄÃ£ Ä‘á»“ng bá»™ Cloud</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">newvision-hub</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-100 dark:border-blue-900/40">
            {pushPermission!=='granted' ? (
              <button
                onClick={requestWebPush}
                className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm"
              >
                <Icon name="bell" size={14}/> Báº­t ThÃ´ng BÃ¡o Äáº©y (Web Push)
              </button>
            ) : (
              <button
                onClick={()=>{
                  showWebPush('ðŸŽ‰ Test ThÃ´ng BÃ¡o Web Push','Há»‡ thá»‘ng thÃ´ng bÃ¡o Ä‘áº©y NewVision HUP Ä‘ang hoáº¡t Ä‘á»™ng hoÃ n háº£o trÃªn mÃ¡y tÃ­nh cá»§a báº¡n!');
                  try{playSound('success');}catch(e){}
                  try{addNotification('ðŸ§ª ÄÃ£ gá»­i thá»­ thÃ´ng bÃ¡o Ä‘áº©y Web Push lÃªn mÃ n hÃ¬nh!','success');}catch(e){}
                }}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-slate-700 hover:text-blue-600"
              >
                <Icon name="send" size={14}/> ðŸ§ª Báº¯n Thá»­ ThÃ´ng BÃ¡o
              </button>
            )}

            <button
              onClick={pushAllToCloud}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Ghi Ä‘Ã¨ dá»¯ liá»‡u hiá»‡n táº¡i lÃªn Cloud Firestore"
            >
              <Icon name="upload-cloud" size={14}/> Äáº©y LÃªn Cloud (Push)
            </button>

            <button
              onClick={pullAllFromCloud}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Táº£i láº¡i toÃ n bá»™ dá»¯ liá»‡u má»›i nháº¥t tá»« Cloud Firestore"
            >
              <Icon name="download-cloud" size={14}/> KÃ©o Tá»« Cloud (Pull)
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">ðŸ’¾ Sao LÆ°u & Äá»“ng Bá»™ Dá»¯ Liá»‡u</label>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Icon name="download" size={20}/>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Xuáº¥t Backup (JSON)</p>
                <p className="text-[11px] text-slate-400">Táº£i file dá»¯ liá»‡u lÆ°u vá» mÃ¡y</p>
              </div>
            </button>

            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport}/>
            <button
              onClick={()=>fileInputRef.current?.click()}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Icon name="upload" size={20}/>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Nháº­p Backup (JSON)</p>
                <p className="text-[11px] text-slate-400">Äá»“ng bá»™ tá»« file backup cÃ³ sáºµn</p>
              </div>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>NewVision HUP v2.5 Pro Â· ÄH DÆ°á»£c HÃ  Ná»™i</span>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-4">ÄÃ³ng</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// PHÃ’NG BAN CHá»¦ NHIá»†M (BCN SECRET HUB)
// ============================================================
function BcnRoomPage(){
  const{
    bcnPin,setBcnPin,bcnUnlocked,setBcnUnlocked,members,setMembers,
    expenses,setExpenses,bcnNotes,setBcnNotes,bcnPlans,setBcnPlans,
    sessions,assignTasks,addNotification,playSound,triggerCat
  }=useContext(AppCtx);

  const[pinInput,setPinInput]=useState('');
  const[shaking,setShaking]=useState(false);
  const[pinEdit,setPinEdit]=useState('');
  const[pinSaved,setPinSaved]=useState(false);
  const[tab,setTab]=useState('radar');
  const[planModal,setPlanModal]=useState(false);
  const[editingPlan,setEditingPlan]=useState(null);
  const[newMilestone,setNewMilestone]=useState('');
  const emptyPlan={title:'',deadline:'',level:'Tuyá»‡t máº­t',pic:'',content:'',milestones:[]};
  const[planForm,setPlanForm]=useState(emptyPlan);

  const handleSavePin=()=>{
    if(!pinEdit.trim()||pinEdit.length<4){alert('MÃ£ PIN má»›i pháº£i cÃ³ Ã­t nháº¥t 4 kÃ½ tá»±!');return}
    setBcnPin(pinEdit.trim());
    setPinSaved(true);
    try{playSound('success');}catch(e){}
    try{addNotification('ðŸ”’ ÄÃ£ Ä‘á»•i mÃ£ PIN Ban Chá»§ Nhiá»‡m thÃ nh cÃ´ng!','success');}catch(e){}
    setTimeout(()=>{setPinSaved(false);setPinEdit('');},2000);
  };

  useEffect(()=>{
    if(bcnUnlocked)return;
    const handleKey=e=>{
      if(e.key>='0'&&e.key<='9'&&pinInput.length<4){
        const next=pinInput+e.key;
        setPinInput(next);
        if(next.length===4)checkPin(next);
      }else if(e.key==='Backspace'){
        setPinInput(p=>p.slice(0,-1));
      }
    };
    window.addEventListener('keydown',handleKey);
    return()=>window.removeEventListener('keydown',handleKey);
  },[bcnUnlocked,pinInput]);

  const checkPin=input=>{
    if(input===bcnPin){
      try{playSound('success');}catch(e){}
      setBcnUnlocked(true);
      try{addNotification('ðŸ”“ Má»Ÿ khÃ³a thÃ nh cÃ´ng PhÃ²ng Ban Chá»§ Nhiá»‡m!','success');}catch(e){}
      setPinInput('');
    }else{
      setShaking(true);
      try{playSound('sos');}catch(e){}
      try{addNotification('MÃ£ PIN khÃ´ng chÃ­nh xÃ¡c! Vui lÃ²ng thá»­ láº¡i.','error');}catch(e){}
      setTimeout(()=>{
        setShaking(false);
        setPinInput('');
      },450);
    }
  };

  const handleNumClick=num=>{
    if(pinInput.length<4){
      const next=pinInput+num;
      setPinInput(next);
      try{playSound('pop');}catch(e){}
      if(next.length===4)checkPin(next);
    }
  };

  const handleLockNow=()=>{
    setBcnUnlocked(false);
    try{playSound('pop');}catch(e){}
    try{addNotification('ðŸ”’ ÄÃ£ khÃ³a PhÃ²ng Ban Chá»§ Nhiá»‡m an toÃ n!','info');}catch(e){}
  };

  const saveMemberBcnNote=async(memberId,noteText)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('bcnNotes').doc('general').set({
        data:{...bcnNotes,[memberId]:noteText}
      },{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification('ðŸ“ ÄÃ£ lÆ°u ghi chÃº BCN cho thÃ nh viÃªn!','success');}catch(e){}
    }catch(err){
      console.error('Lá»—i lÆ°u ghi chÃº BCN:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const setMemberEval=async(memberId,newEval)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('members').doc(memberId).set({eval:newEval},{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification(`ÄÃ£ cáº­p nháº­t Ä‘Ã¡nh giÃ¡ thÃ nh viÃªn thÃ nh: ${newEval}`,'info');}catch(e){}
    }catch(err){
      console.error('Lá»—i lÆ°u Ä‘Ã¡nh giÃ¡ thÃ nh viÃªn:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleApproveExpense=async(exp)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('expenses').doc(exp.id).set({status:'ÄÃ£ quyáº¿t toÃ¡n'},{merge:true});
      try{playSound('success');}catch(e){}
      triggerCat('celebrate');
      try{addNotification(`âœ… ÄÃ£ duyá»‡t quyáº¿t toÃ¡n cho ${exp.person||'thÃ nh viÃªn'}: ${fmtVND(exp.amount)}`,'success');}catch(e){}
    }catch(err){
      console.error('Lá»—i duyá»‡t quyáº¿t toÃ¡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleRejectExpense=async(exp)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('expenses').doc(exp.id).set({
        status:'Cáº§n giáº£i trÃ¬nh',
        note:(exp.note||'')+' [BCN yÃªu cáº§u giáº£i trÃ¬nh thÃªm]'
      },{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification(`âš ï¸ ÄÃ£ yÃªu cáº§u giáº£i trÃ¬nh khoáº£n chi "${exp.name}"`,'warning');}catch(e){}
    }catch(err){
      console.error('Lá»—i tá»« chá»‘i quyáº¿t toÃ¡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const openAddPlan=()=>{setEditingPlan(null);setPlanForm(emptyPlan);setPlanModal(true)};
  const openEditPlan=p=>{setEditingPlan(p.id);setPlanForm({...p});setPlanModal(true)};
  const handleSavePlan=async()=>{
    if(!planForm.title.trim()){alert('Vui lÃ²ng nháº­p tÃªn chiáº¿n lÆ°á»£c!');return}
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      if(editingPlan){
        await fbDb.collection('bcnPlans').doc(editingPlan).set(planForm,{merge:true});
      }else{
        const id=uid();
        await fbDb.collection('bcnPlans').doc(id).set({
          ...planForm,
          id,
          createdAt:new Date().toISOString()
        });
      }
      setPlanModal(false);
      try{playSound('success');}catch(e){}
      try{addNotification('ðŸŽ¯ ÄÃ£ lÆ°u káº¿ hoáº¡ch tÃ¡c chiáº¿n máº­t!','success');}catch(e){}
    }catch(err){
      console.error('Lá»—i lÆ°u káº¿ hoáº¡ch BCN:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const toggleMilestone=async(planId,mId)=>{
    const pl=bcnPlans.find(x=>x.id===planId);
    if(!pl)return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const updatedMilestones=(pl.milestones||[]).map(m=>m.id===mId?{...m,done:!m.done}:m);
      await fbDb.collection('bcnPlans').doc(planId).set({milestones:updatedMilestones},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i cáº­p nháº­t má»‘c tiáº¿n Ä‘á»™:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const handleDeletePlan=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('bcnPlans').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ xÃ³a káº¿ hoáº¡ch BCN','info');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a káº¿ hoáº¡ch:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const addMilestoneToForm=()=>{
    if(!newMilestone.trim())return;
    setPlanForm(p=>({...p,milestones:[...(p.milestones||[]),{id:uid(),text:newMilestone.trim(),done:false}]}));
    setNewMilestone('');
  };

  const totalSessions=sessions.length;
  const alertMembers=useMemo(()=>{
    return members.filter(m=>{
      const isBadEval=m.eval==='Cáº§n theo dÃµi'||m.eval==='KhÃ´ng Ä‘áº¡t';
      const presentCount=sessions.filter(s=>m.attendance?.[s.id]==='CÃ³ máº·t').length;
      const attPct=totalSessions>0?Math.round(presentCount/totalSessions*100):100;
      const trackedTasks=assignTasks.filter(t=>m.taskStatus?.[t.id]);
      const onTimeCount=trackedTasks.filter(t=>m.taskStatus?.[t.id]==='ÄÃºng háº¡n').length;
      const taskPct=trackedTasks.length>0?Math.round(onTimeCount/trackedTasks.length*100):100;
      return isBadEval||attPct<60||taskPct<60;
    });
  },[members,sessions,assignTasks,totalSessions]);

  const pendingExpenses=useMemo(()=>{
    return expenses.filter(e=>e.status==='ÄÃ£ chi - Chá» hoÃ n tiá»n'||(Number(e.amount)||0)>=300000);
  },[expenses]);

  if(!bcnUnlocked){
    return(
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className={`card max-w-sm w-full p-6 text-center shadow-2xl border-2 border-amber-300 dark:border-amber-900/60 bg-gradient-to-b from-white to-amber-50/30 dark:from-slate-800 dark:to-slate-900 ${shaking?'shake-keypad':''}`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg pulse-shield">
            <Icon name="shield-alert" size={32}/>
          </div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">Khu Vá»±c Báº£o Máº­t BCN</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">Nháº­p mÃ£ PIN Ä‘á»ƒ truy cáº­p phÃ²ng tÃ¡c chiáº¿n kÃ­n</p>
          <div className="flex justify-center items-center gap-3 mb-6">
            {[0,1,2,3].map(i=>(
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${i<pinInput.length?'bg-amber-500 border-amber-500 scale-125 shadow-md':'border-slate-300 dark:border-slate-600'}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto mb-4">
            {['1','2','3','4','5','6','7','8','9'].map(n=>(
              <button
                key={n}
                onClick={()=>handleNumClick(n)}
                className="h-12 rounded-xl text-lg font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-amber-50 hover:border-amber-300 text-slate-800 dark:text-white shadow-sm transition active:scale-95"
              >
                {n}
              </button>
            ))}
            <button
              onClick={()=>{setPinInput('');try{playSound('pop');}catch(e){}}}
              className="h-12 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-500 hover:bg-slate-200 transition"
            >
              XÃ³a
            </button>
            <button
              onClick={()=>handleNumClick('0')}
              className="h-12 rounded-xl text-lg font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-amber-50 hover:border-amber-300 text-slate-800 dark:text-white shadow-sm transition active:scale-95"
            >
              0
            </button>
            <button
              onClick={()=>setPinInput(p=>p.slice(0,-1))}
              className="h-12 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center"
            >
              âŒ«
            </button>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="space-y-4">
      <div className="card p-4 border-l-4 border-amber-500 bg-gradient-to-r from-amber-500/10 via-white to-transparent dark:from-amber-950/30 dark:to-transparent flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <Icon name="shield-check" size={22}/>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              PhÃ²ng Ban Chá»§ Nhiá»‡m (BCN Secret Hub)
              <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">ÄÃƒ Má»ž KHÃ“A</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">KhÃ´ng gian quáº£n trá»‹ tá»‘i máº­t dÃ nh cho BCN NewVision</p>
          </div>
        </div>
        <button onClick={handleLockNow} className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3">
          <Icon name="lock" size={14}/>KhÃ³a PhÃ²ng Ngay
        </button>
      </div>

      {/* KHU Vá»°C THIáº¾T Láº¬P MÃƒ PIN Báº¢O Máº¬T BCN */}
      <div className="card p-3.5 border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Icon name="key" size={16}/>
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Äá»•i MÃ£ PIN Ban Chá»§ Nhiá»‡m</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Chá»‰ thÃ nh viÃªn BCN Ä‘Ã£ má»Ÿ khÃ³a má»›i cÃ³ quyá»n Ä‘á»•i mÃ£ nÃ y</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            maxLength={8}
            value={pinEdit}
            onChange={e=>setPinEdit(e.target.value)}
            className="form-input text-xs font-mono tracking-widest text-center w-28 py-1.5"
            placeholder="PIN má»›i..."
          />
          <button onClick={handleSavePin} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
            {pinSaved ? 'âœ“ ÄÃ£ LÆ°u' : 'LÆ°u PIN'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          ['radar','ðŸš¨ Radar NhÃ¢n Sá»± Nháº¡y Cáº£m',alertMembers.length],
          ['expenses','ðŸ’° Duyá»‡t Quá»¹ & Chi PhÃ­ Lá»›n',pendingExpenses.length],
          ['plans','ðŸŽ¯ Káº¿ Hoáº¡ch TÃ¡c Chiáº¿n Máº­t',bcnPlans.length],
        ].map(([v,l,count])=>(
          <button
            key={v}
            onClick={()=>setTab(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${tab===v?'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white':'text-slate-500 hover:text-slate-700'}`}
          >
            <span>{l}</span>
            {count>0&&<span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 leading-none">{count}</span>}
          </button>
        ))}
      </div>

      {tab==='radar'&&(
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card p-3 border-l-4 border-red-500">
              <p className="text-xs text-slate-400">Tá»•ng Cáº£nh BÃ¡o</p>
              <p className="text-2xl font-black text-red-500">{alertMembers.length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ThÃ nh viÃªn / CTV cáº§n can thiá»‡p</p>
            </div>
            <div className="card p-3 border-l-4 border-amber-500">
              <p className="text-xs text-slate-400">Cáº§n Theo DÃµi</p>
              <p className="text-2xl font-black text-amber-500">{alertMembers.filter(m=>m.eval==='Cáº§n theo dÃµi').length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Cáº§n nháº¯c nhá»Ÿ & há»— trá»£</p>
            </div>
            <div className="card p-3 border-l-4 border-rose-600">
              <p className="text-xs text-slate-400">KhÃ´ng Äáº¡t</p>
              <p className="text-2xl font-black text-rose-600">{alertMembers.filter(m=>m.eval==='KhÃ´ng Ä‘áº¡t').length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Xem xÃ©t cho thÃ´i sinh hoáº¡t</p>
            </div>
          </div>

          {alertMembers.length===0?(
            <div className="card py-16 text-center">
              <span className="text-4xl block mb-2">ðŸŽ‰</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">KhÃ´ng cÃ³ nhÃ¢n sá»± nÃ o trong danh sÃ¡ch cáº£nh bÃ¡o!</p>
              <p className="text-xs text-slate-400 mt-1">ToÃ n bá»™ thÃ nh viÃªn vÃ  CTV Ä‘á»u cÃ³ tinh tháº§n lÃ m viá»‡c vÃ  tham gia Ä‘áº¡t chuáº©n.</p>
            </div>
          ):(
            <div className="space-y-3">
              {alertMembers.map(m=>(
                <div key={m.id} className="card p-4 border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white font-bold flex items-center justify-center text-base shadow">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-slate-800 dark:text-white">{m.name}</h4>
                          <span className={`status-badge text-[11px] ${evalColor(m.eval||'Äáº¡t')}`}>{m.eval}</span>
                          <span className="status-badge tag-gray text-[11px]">{m.role}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{m.ban||'ChÆ°a phÃ¢n ban'} Â· {m.khoa||''} {m.phone?`Â· ðŸ“ž ${m.phone}`:''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={()=>setMemberEval(m.id,'Äáº¡t')} className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg">Chuyá»ƒn "Äáº¡t"</button>
                      <button onClick={()=>setMemberEval(m.id,'Cáº§n theo dÃµi')} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2.5 py-1 rounded-lg">Cáº§n theo dÃµi</button>
                      <button onClick={()=>setMemberEval(m.id,'KhÃ´ng Ä‘áº¡t')} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-semibold px-2.5 py-1 rounded-lg">KhÃ´ng Ä‘áº¡t</button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1.5">ðŸ”’ Sá»• ghi chÃº kÃ­n cá»§a BCN (Chá»‰ BCN nhÃ¬n tháº¥y):</label>
                    <div className="flex gap-2">
                      <input
                        defaultValue={bcnNotes[m.id]||''}
                        onBlur={e=>saveMemberBcnNote(m.id,e.target.value)}
                        placeholder="VD: Cáº§n háº¹n gáº·p 1-1 trao Ä‘á»•i, dáº¡o nÃ y báº­n thi chuyÃªn ngÃ nh..."
                        className="form-input text-xs py-1.5 flex-1"
                      />
                      <button
                        onClick={e=>{
                          const inp=e.currentTarget.previousSibling;
                          saveMemberBcnNote(m.id,inp.value);
                        }}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        LÆ°u
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==='expenses'&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Khoáº£n Chi Cáº§n Duyá»‡t & Chi PhÃ­ Lá»›n</h3>
            <span className="text-xs text-slate-400">Tá»•ng chá» duyá»‡t: <strong>{fmtVND(pendingExpenses.filter(e=>e.status==='ÄÃ£ chi - Chá» hoÃ n tiá»n').reduce((s,e)=>s+(Number(e.amount)||0),0))}</strong></span>
          </div>

          {pendingExpenses.length===0?(
            <div className="card py-16 text-center">
              <span className="text-3xl block mb-2">ðŸ’°</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">KhÃ´ng cÃ³ khoáº£n chi nÃ o chá» duyá»‡t!</p>
              <p className="text-xs text-slate-400 mt-1">Táº¥t cáº£ chi tiÃªu cá»§a CLB Ä‘Ã£ Ä‘Æ°á»£c quyáº¿t toÃ¡n hoÃ n táº¥t.</p>
            </div>
          ):(
            <div className="space-y-3">
              {pendingExpenses.map(e=>(
                <div key={e.id} className="card p-4 border-l-4 border-amber-500 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base flex-shrink-0">
                      â‚«
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">{e.name}</h4>
                        <span className={`status-badge text-[11px] ${expenseColor(e.status)}`}>{e.status}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        NgÆ°á»i chi: <strong>{e.person||'â€”'}</strong> Â· Ban: {e.ban||'ToÃ n CLB'} {e.note?`Â· "${e.note}"`:''}
                      </p>
                      <p className="text-base font-black text-orange-600 mt-1">{fmtVND(e.amount)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={()=>handleRejectExpense(e)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                      <Icon name="alert-circle" size={13}/>YÃªu Cáº§u Giáº£i TrÃ¬nh
                    </button>
                    <button onClick={()=>handleApproveExpense(e)} className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1">
                      <Icon name="check" size={14}/>Duyá»‡t Quyáº¿t ToÃ¡n
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==='plans'&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Chiáº¿n LÆ°á»£c & Káº¿ Hoáº¡ch TÃ¡c Chiáº¿n KÃ­n</h3>
              <p className="text-xs text-slate-400">CÃ¡c Ä‘á»‹nh hÆ°á»›ng nhÃ¢n sá»±, tÃ i trá»£ vÃ  sá»± kiá»‡n chÆ°a cÃ´ng bá»‘</p>
            </div>
            <button onClick={openAddPlan} className="btn-primary text-xs flex items-center gap-1.5">
              <Icon name="plus" size={14}/>Táº¡o Káº¿ Hoáº¡ch Má»›i
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {bcnPlans.map(p=>(
              <div key={p.id} className="card p-4 border-t-4 border-amber-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.level==='Tuyá»‡t máº­t'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{p.level}</span>
                    {p.deadline&&<span className="text-xs text-slate-400">Má»¥c tiÃªu: {fmtDate(p.deadline)}</span>}
                  </div>
                  <h4 className="font-bold text-base text-slate-800 dark:text-white mb-1.5">{p.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{p.content}</p>

                  <div className="space-y-1.5 mb-3 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Má»‘c HÃ nh Äá»™ng:</p>
                    {(p.milestones||[]).map(m=>(
                      <div key={m.id} onClick={()=>toggleMilestone(p.id,m.id)} className="flex items-center gap-2 cursor-pointer text-xs">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${m.done?'bg-emerald-500 text-white border-emerald-500':'border-slate-300'}`}>
                          {m.done?'âœ“':''}
                        </span>
                        <span className={m.done?'line-through text-slate-400':'text-slate-700 dark:text-slate-300'}>{m.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                  <span className="text-slate-400">Phá»¥ trÃ¡ch: <strong>{p.pic||'BCN'}</strong></span>
                  <div className="flex gap-2">
                    <button onClick={()=>openEditPlan(p)} className="text-blue-500 hover:text-blue-700 font-medium">Sá»­a</button>
                    <button onClick={()=>handleDeletePlan(p.id)} className="text-red-400 hover:text-red-600 font-medium">XÃ³a</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={planModal} onClose={()=>setPlanModal(false)} title={editingPlan?'Sá»­a Káº¿ Hoáº¡ch TÃ¡c Chiáº¿n':'Táº¡o Káº¿ Hoáº¡ch TÃ¡c Chiáº¿n Máº­t Má»›i'}>
        <div className="space-y-3">
          <div><label className="form-label">TÃªn chiáº¿n lÆ°á»£c / Dá»± Ã¡n máº­t</label><input value={planForm.title} onChange={e=>setPlanForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="VD: Chiáº¿n dá»‹ch Tuyá»ƒn CTV K81..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Cáº¥p Ä‘á»™ báº£o máº­t</label><select value={planForm.level} onChange={e=>setPlanForm(p=>({...p,level:e.target.value}))} className="form-input"><option>Tuyá»‡t máº­t</option><option>Ná»™i bá»™ BCN</option><option>Æ¯u tiÃªn cao</option></select></div>
            <div><label className="form-label">Thá»i háº¡n má»¥c tiÃªu</label><input type="date" value={planForm.deadline} onChange={e=>setPlanForm(p=>({...p,deadline:e.target.value}))} className="form-input"/></div>
          </div>
          <div><label className="form-label">NgÆ°á»i phá»¥ trÃ¡ch chÃ­nh (PIC)</label><input value={planForm.pic} onChange={e=>setPlanForm(p=>({...p,pic:e.target.value}))} className="form-input" placeholder="VD: Chá»§ nhiá»‡m, PhÃ³ CN..."/></div>
          <div><label className="form-label">Ná»™i dung chiáº¿n lÆ°á»£c</label><textarea value={planForm.content} onChange={e=>setPlanForm(p=>({...p,content:e.target.value}))} className="form-input resize-none min-h-[70px]" placeholder="Má»¥c tiÃªu, phÆ°Æ¡ng thá»©c triá»ƒn khai kÃ­n..."/></div>
          <div>
            <label className="form-label">Má»‘c hÃ nh Ä‘á»™ng</label>
            <div className="flex gap-2 mb-2">
              <input value={newMilestone} onChange={e=>setNewMilestone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addMilestoneToForm())} className="form-input text-xs flex-1" placeholder="ThÃªm má»‘c cÃ´ng viá»‡c..."/>
              <button type="button" onClick={addMilestoneToForm} className="btn-secondary text-xs px-3">ThÃªm má»‘c</button>
            </div>
            <div className="space-y-1">
              {(planForm.milestones||[]).map((m,idx)=>(
                <div key={m.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                  <span>{idx+1}. {m.text}</span>
                  <button type="button" onClick={()=>setPlanForm(p=>({...p,milestones:p.milestones.filter(x=>x.id!==m.id)}))} className="text-red-400 hover:text-red-600"><Icon name="x" size={12}/></button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={()=>setPlanModal(false)} className="btn-secondary flex-1">Há»§y</button>
            <button onClick={handleSavePlan} className="btn-primary flex-1">LÆ°u Káº¿ Hoáº¡ch</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// COMMAND PALETTE
// ============================================================
function CommandPalette({open,onClose,setActiveTab}){
  const{decisions,events,members,resources,studyResources,inventory}=useContext(AppCtx);
  const[query,setQuery]=useState('');
  const inputRef=useRef(null);

  useEffect(()=>{if(open&&inputRef.current){setQuery('');setTimeout(()=>inputRef.current?.focus(),80)}},[open]);
  useEffect(()=>{
    function h(e){if(open&&e.key==='Escape')onClose()}
    document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);
  },[open,onClose]);

  const results=useMemo(()=>{
    if(!query.trim())return[];
    const q=query.toLowerCase();
    const r=[];
    decisions.filter(d=>d.title.toLowerCase().includes(q)).slice(0,2).forEach(d=>r.push({label:d.title,sub:d.status,icon:'file-check-2',tab:'decisions',type:'Quyáº¿t Ä‘á»‹nh',tcolor:'text-amber-600',tbg:'bg-amber-50'}));
    events.filter(e=>e.name.toLowerCase().includes(q)).slice(0,2).forEach(e=>r.push({label:e.name,sub:fmtDate(e.date),icon:'calendar-days',tab:'events',type:'Sá»± kiá»‡n',tcolor:'text-blue-600',tbg:'bg-blue-50'}));
    (studyResources||[]).filter(s=>(s.title||'').toLowerCase().includes(q)||(s.note||'').toLowerCase().includes(q)).slice(0,3).forEach(s=>r.push({label:s.title,sub:`${s.category} â€¢ ${s.block}`,icon:'book-open',tab:'study',type:'Há»c táº­p',tcolor:'text-orange-600',tbg:'bg-orange-50'}));
    members.filter(m=>m.name.toLowerCase().includes(q)).slice(0,2).forEach(m=>r.push({label:m.name,sub:m.ban||m.role,icon:'user',tab:'members',type:'ThÃ nh viÃªn',tcolor:'text-emerald-600',tbg:'bg-emerald-50'}));
    resources.filter(r2=>r2.title.toLowerCase().includes(q)).slice(0,2).forEach(r2=>r.push({label:r2.title,sub:r2.type,icon:'link',tab:'resources',type:'TÃ i nguyÃªn',tcolor:'text-purple-600',tbg:'bg-purple-50'}));
    inventory.filter(i=>i.name.toLowerCase().includes(q)).slice(0,2).forEach(i=>r.push({label:i.name,sub:i.status,icon:'box',tab:'resources',type:'Váº­t dá»¥ng',tcolor:'text-teal-600',tbg:'bg-teal-50'}));
    return r.slice(0,9);
  },[query,decisions,events,members,resources,studyResources,inventory]);

  if(!open)return null;
  return(
    <div className="fixed inset-0 z-[200] bg-black/55 flex items-start justify-center pt-[10vh] px-4" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden cmd-in border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <Icon name="search" size={18} className="text-slate-400 flex-shrink-0"/>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="TÃ¬m nhanh cÃ´ng viá»‡c, sá»± kiá»‡n, thÃ nh viÃªn, tÃ i liá»‡u..." className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"/>
          <div className="flex items-center gap-1 flex-shrink-0">
            <kbd className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 rounded px-1.5 py-0.5">Ctrl K</kbd>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><Icon name="x" size={14} className="text-slate-400"/></button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {query&&results.length===0&&<p className="text-center text-sm text-slate-400 py-10">KhÃ´ng tÃ¬m tháº¥y káº¿t quáº£ nÃ o cho "<b>{query}</b>"</p>}
          {query&&results.map((r,i)=>(
            <button key={i} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-left" onClick={()=>{setActiveTab(r.tab);onClose()}}>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.tbg}`}><Icon name={r.icon} size={17} className={r.tcolor}/></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{r.label}</p>
                <p className="text-xs text-slate-400 truncate">{r.sub}</p>
              </div>
              <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 flex-shrink-0 ${r.tbg} ${r.tcolor}`}>{r.type}</span>
            </button>
          ))}
          {!query&&(
            <div className="px-4 py-8 text-center">
              <Icon name="search" size={36} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-sm text-slate-400 font-medium">Báº¯t Ä‘áº§u gÃµ Ä‘á»ƒ tÃ¬m kiáº¿m toÃ n CLB</p>
              <p className="text-xs text-slate-300 mt-1">TÃ¬m trong: Quyáº¿t Ä‘á»‹nh Â· Sá»± kiá»‡n Â· ThÃ nh viÃªn Â· TÃ i nguyÃªn Â· Váº­t dá»¥ng</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION BELL
// ============================================================
function NotificationBell(){
  const{notifications,unreadCount,markRead,markAllRead}=useContext(AppCtx);
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);
  },[]);
  const recent=notifications.slice(0,10);
  const typeIcons={info:'info',success:'check-circle',warning:'alert-triangle',error:'x-circle'};
  const typeColors={info:'text-blue-500',success:'text-emerald-500',warning:'text-amber-500',error:'text-red-500'};
  return(
    <div className="relative" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} className="relative p-2 rounded-xl hover:bg-slate-100 transition">
        <Icon name="bell" size={22} className="text-slate-600"/>
        {unreadCount>0&&<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCount>99?'99+':unreadCount}</span>}
      </button>
      {open&&(
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 slide-down overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-bold text-slate-800 text-sm">ThÃ´ng bÃ¡o {unreadCount>0&&<span className="ml-1 bg-red-100 text-red-600 text-[11px] font-bold px-1.5 rounded-full">{unreadCount}</span>}</span>
            {unreadCount>0&&<button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Äá»c táº¥t cáº£</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.length===0?<div className="py-10 text-center text-slate-400 text-sm"><Icon name="bell-off" size={28} className="mx-auto mb-2 text-slate-200"/>ChÆ°a cÃ³ thÃ´ng bÃ¡o</div>:recent.map(n=>(
              <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition ${!n.read?'bg-blue-50/60':''}`}>
                <span className={`mt-0.5 flex-shrink-0 ${typeColors[n.type]||typeColors.info}`}><Icon name={typeIcons[n.type]||'info'} size={16}/></span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${!n.read?'font-semibold text-slate-800':'text-slate-600'}`}>{n.message}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{relTime(n.timestamp)}</p>
                </div>
                {!n.read&&<button onClick={()=>markRead(n.id)} className="flex-shrink-0 text-[11px] text-blue-500 hover:text-blue-700 font-medium">Äá»c</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({setActiveTab}){
  const{decisions,events,members,quickChecklist,setQuickChecklist,quickLinks,setQuickLinks,triggerCat,isInitialSnapshot}=useContext(AppCtx);
  const[showCLForm,setShowCLForm]=useState(false);
  const[newItem,setNewItem]=useState('');
  const[showLinkForm,setShowLinkForm]=useState(false);
  const[newLink,setNewLink]=useState({title:'',url:''});
  const[now,setNow]=useState(Date.now());
  const[targetGTime,setTargetGTime]=useLocalStorage('nv_target_g_time','');
  const[showGTimeModal,setShowGTimeModal]=useState(false);
  const[customGInput,setCustomGInput]=useState('');

  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(timer);
  },[]);

  const allTasks=events.flatMap(e=>(e.tasks||[]).map(t=>({...t,eventId:e.id})));
  const activeTasks=allTasks.filter(t=>!t.done);
  const overdueTasks=allTasks.filter(t=>!t.done&&isOverdue(t.deadline));
  const pendingDecisions=decisions.filter(d=>d.status!=='ÄÃ£ chá»‘t chÃ­nh thá»©c');

  const nextEvent=events.filter(e=>e.date&&new Date(e.date)>=new Date(Date.now()-86400000)).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  const effectiveGTime=targetGTime||(nextEvent?`${nextEvent.date}T18:00`:'');
  const diffG=effectiveGTime?(new Date(effectiveGTime).getTime()-now):null;

  let gCountdownText='--:--:--';
  let isGPassed=false;
  if(diffG!==null){
    if(diffG<=0){
      isGPassed=true;
      gCountdownText='âš¡ ÄÃƒ Äáº¾N GIá»œ G!';
    }else{
      const days=Math.floor(diffG/(1000*60*60*24));
      const hours=Math.floor((diffG/(1000*60*60))%24);
      const mins=Math.floor((diffG/(1000*60))%60);
      const secs=Math.floor((diffG/1000)%60);
      const pad=n=>n.toString().padStart(2,'0');
      gCountdownText=`${days>0?days+'d ':''}${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
  }

  const addCLItem=async()=>{
    if(!newItem.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const id=uid();
      await fbDb.collection('quickChecklist').doc(id).set({
        id,
        text:newItem.trim(),
        done:false,
        createdAt:new Date().toISOString()
      });
      triggerCat('dash');
      setNewItem('');
      setShowCLForm(false);
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i thÃªm checklist:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const toggleCL=async(id)=>{
    const item=quickChecklist.find(i=>i.id===id);
    if(!item)return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const newDone=!item.done;
      if(newDone && !isInitialSnapshot)triggerCat('celebrate');
      await fbDb.collection('quickChecklist').doc(id).set({done:newDone},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i cáº­p nháº­t checklist:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const resetCL=async()=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const batch=fbDb.batch();
      quickChecklist.forEach(i=>{
        batch.set(fbDb.collection('quickChecklist').doc(i.id),{done:false},{merge:true});
      });
      await batch.commit();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i reset checklist:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const delCL=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('quickChecklist').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a checklist:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const addLink=async()=>{
    if(!newLink.title.trim()||!newLink.url.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const id=uid();
      await fbDb.collection('quickLinks').doc(id).set({
        id,
        ...newLink,
        createdAt:new Date().toISOString()
      });
      setNewLink({title:'',url:''});
      setShowLinkForm(false);
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i thÃªm quick link:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const delLink=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('quickLinks').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a quick link:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const stats=[
    {label:'Viá»‡c Ä‘ang cháº¡y',value:activeTasks.length,icon:'list-todo',gradient:'from-blue-600 to-blue-800',onClick:()=>setActiveTab('events')},
    {label:'Viá»‡c quÃ¡ háº¡n',value:overdueTasks.length,icon:'alarm-clock',gradient:'from-red-500 to-red-700',onClick:()=>setActiveTab('events')},
    {label:'Quyáº¿t Ä‘á»‹nh chá» chá»‘t',value:pendingDecisions.length,icon:'file-question',gradient:'from-amber-500 to-orange-600',onClick:()=>setActiveTab('decisions')},
    {label:'Tá»•ng thÃ nh viÃªn/CTV',value:members.length,icon:'users',gradient:'from-emerald-500 to-teal-700',onClick:()=>setActiveTab('members')},
  ];

  return(
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Báº£ng Äiá»u Khiá»ƒn</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tá»•ng quan hoáº¡t Ä‘á»™ng CLB NewVision HUP â€“ ÄH DÆ°á»£c HN</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s,i)=>(
          <button key={i} onClick={s.onClick} className={`bg-gradient-to-br ${s.gradient} text-white rounded-2xl p-4 text-left hover:opacity-90 transition-opacity shadow-md`}>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3"><Icon name={s.icon} size={20} className="text-white"/></div>
            <div className="text-3xl font-bold leading-none">{s.value}</div>
            <div className="text-xs font-medium opacity-80 mt-1">{s.label}</div>
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center"><Icon name="zap" size={15} className="text-amber-600"/></div>
              <span className="font-bold text-sm text-slate-800">Checklist 15 PhÃºt TrÆ°á»›c Giá» G</span>
            </div>
            <div className="flex gap-1">
              {quickChecklist.some(i=>i.done)&&<button onClick={resetCL} title="Reset" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"><Icon name="rotate-ccw" size={13}/></button>}
              <button onClick={()=>setShowCLForm(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={13}/>ThÃªm</button>
            </div>
          </div>

          {/* Äá»’NG Há»’ Äáº¾M NGÆ¯á»¢C GIá»œ G THá»œI GIAN THá»°C */}
          <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 rounded-xl p-2.5 mb-3 border border-orange-200 dark:border-orange-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold text-orange-950 dark:text-orange-200">Äáº¿m NgÆ°á»£c Giá» G:</span>
              <span className={`font-mono font-black text-sm tracking-wider ${isGPassed?'text-emerald-600 dark:text-emerald-400':'text-orange-600 dark:text-orange-400'}`}>
                {gCountdownText}
              </span>
            </div>
            <button
              onClick={()=>{setCustomGInput(effectiveGTime||'');setShowGTimeModal(true)}}
              className="text-[10px] text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-orange-200 dark:border-slate-700 shadow-sm flex-shrink-0"
              title="CÃ i Ä‘áº·t Giá» G"
            >
              <Icon name="clock" size={11}/>
              {effectiveGTime ? new Date(effectiveGTime).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : 'Chá»n giá»'}
            </button>
          </div>
          {showCLForm&&(
            <div className="flex gap-2 mb-3">
              <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCLItem()} placeholder="TÃªn háº¡ng má»¥c..." className="form-input flex-1 text-sm" autoFocus/>
              <button onClick={addCLItem} className="btn-primary text-xs px-3">ThÃªm</button>
              <button onClick={()=>setShowCLForm(false)} className="btn-secondary text-xs px-2">Há»§y</button>
            </div>
          )}
          {quickChecklist.length===0&&<div className="py-8 text-center"><Icon name="clipboard-list" size={32} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">ThÃªm cÃ¡c háº¡ng má»¥c kiá»ƒm tra nhanh</p></div>}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {quickChecklist.map(item=>(
              <div key={item.id} className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 group transition ${item.done?'opacity-60':''}`}>
                <input type="checkbox" checked={item.done} onChange={()=>toggleCL(item.id)} className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"/>
                <span className={`flex-1 text-sm ${item.done?'line-through text-slate-400':'text-slate-700'}`}>{item.text}</span>
                <button onClick={()=>delCL(item.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition"><Icon name="trash-2" size={13} className="text-red-400"/></button>
              </div>
            ))}
          </div>
          {quickChecklist.length>0&&<div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">{quickChecklist.filter(i=>i.done).length}/{quickChecklist.length} má»¥c hoÃ n thÃ nh</div>}
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center"><Icon name="link" size={15} className="text-purple-600"/></div>
              <span className="font-bold text-sm text-slate-800">Link Nhanh DÃ¹ng Chung</span>
            </div>
            <button onClick={()=>setShowLinkForm(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={13}/>ThÃªm</button>
          </div>
          {showLinkForm&&(
            <div className="space-y-2 mb-3 p-3 bg-slate-50 rounded-xl">
              <input value={newLink.title} onChange={e=>setNewLink(p=>({...p,title:e.target.value}))} placeholder="TÃªn tÃ i nguyÃªn..." className="form-input text-sm"/>
              <input value={newLink.url} onChange={e=>setNewLink(p=>({...p,url:e.target.value}))} placeholder="https://..." className="form-input text-sm"/>
              <div className="flex gap-2"><button onClick={addLink} className="btn-primary text-xs px-3">ThÃªm</button><button onClick={()=>setShowLinkForm(false)} className="btn-secondary text-xs px-2">Há»§y</button></div>
            </div>
          )}
          {quickLinks.length===0&&<div className="py-8 text-center"><Icon name="folder-open" size={32} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">Ghim nhanh link Drive, Canva, Form...</p></div>}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quickLinks.map(l=>(
              <div key={l.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 group transition">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"><Icon name="external-link" size={14} className="text-blue-600"/></div>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{l.title}</p>
                  <p className="text-xs text-blue-500 truncate">{l.url}</p>
                </a>
                <button onClick={()=>delLink(l.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition"><Icon name="trash-2" size={13} className="text-red-400"/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2"><Icon name="activity" size={16} className="text-indigo-500"/>Tá»•ng Quan Nhanh</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600 font-semibold mb-1">ðŸ“… Sá»± kiá»‡n sáº¯p tá»›i</p>
            {events.filter(e=>new Date(e.date)>=new Date()).slice(0,3).map(e=><p key={e.id} className="text-slate-700 text-xs truncate mt-1">Â· {e.name} â€” {fmtDate(e.date)}</p>)}
            {events.filter(e=>new Date(e.date)>=new Date()).length===0&&<p className="text-slate-400 text-xs">ChÆ°a cÃ³ sá»± kiá»‡n nÃ o</p>}
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-amber-600 font-semibold mb-1">âš¡ Cáº§n duyá»‡t</p>
            {decisions.filter(d=>d.status==='Cáº§n duyá»‡t').slice(0,3).map(d=><p key={d.id} className="text-slate-700 text-xs truncate mt-1">Â· {d.title}</p>)}
            {decisions.filter(d=>d.status==='Cáº§n duyá»‡t').length===0&&<p className="text-slate-400 text-xs">KhÃ´ng cÃ³</p>}
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-red-600 font-semibold mb-1">ðŸ”´ QuÃ¡ háº¡n</p>
            {allTasks.filter(t=>!t.done&&isOverdue(t.deadline)).slice(0,3).map(t=><p key={t.id} className="text-slate-700 text-xs truncate mt-1">Â· {t.title}</p>)}
            {allTasks.filter(t=>!t.done&&isOverdue(t.deadline)).length===0&&<p className="text-slate-400 text-xs">Tá»‘t, khÃ´ng cÃ³ viá»‡c quÃ¡ háº¡n!</p>}
          </div>
        </div>
      </div>

      {showGTimeModal&&(
        <Modal open={showGTimeModal} onClose={()=>setShowGTimeModal(false)} title="CÃ i Äáº·t Má»‘c Giá» G Sá»± Kiá»‡n">
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Thiáº¿t láº­p má»‘c thá»i gian diá»…n ra sá»± kiá»‡n (Giá» G) Ä‘á»ƒ Ä‘á»“ng há»“ Ä‘áº¿m ngÆ°á»£c trá»±c tiáº¿p:</p>
            <div>
              <label className="form-label">Chá»n NgÃ y & Giá» G</label>
              <input
                type="datetime-local"
                value={customGInput}
                onChange={e=>setCustomGInput(e.target.value)}
                className="form-input text-sm"
              />
            </div>
            {nextEvent&&(
              <button
                type="button"
                onClick={()=>setCustomGInput(`${nextEvent.date}T18:00`)}
                className="text-xs text-orange-600 hover:underline flex items-center gap-1 font-medium"
              >
                ðŸ“… Láº¥y theo sá»± kiá»‡n gáº§n nháº¥t: {nextEvent.name} ({fmtDate(nextEvent.date)})
              </button>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={()=>{setTargetGTime('');setShowGTimeModal(false)}}
                className="btn-secondary flex-1 text-xs"
              >
                Máº·c Ä‘á»‹nh theo sá»± kiá»‡n
              </button>
              <button
                onClick={()=>{if(customGInput)setTargetGTime(customGInput);setShowGTimeModal(false)}}
                className="btn-primary flex-1 text-xs"
              >
                LÆ°u Má»‘c Giá» G
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// DECISIONS PAGE â€“ with Fast Poll / Biá»ƒu Quyáº¿t Nhanh
// ============================================================
function DecisionsPage(){
  const{decisions,setDecisions,addNotification,triggerMascot}=useContext(AppCtx);
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[filterBan,setFilterBan]=useState('');
  const[filterStatus,setFilterStatus]=useState('');
  const[confirmDel,setConfirmDel]=useState(null);
  const[pollInput,setPollInput]=useState({});
  const emptyForm={title:'',proposer:'',ban:'',pic:'',deadline:'',resolution:'',status:'Äang bÃ n báº¡c'};
  const[form,setForm]=useState(emptyForm);

  const openAdd=()=>{setEditing(null);setForm(emptyForm);setModal(true)};
  const openEdit=d=>{setEditing(d.id);setForm({...emptyForm,...d});setModal(true)};
  const handleClose=()=>{setModal(false);setEditing(null);setForm(emptyForm)};

  const handleSave=async()=>{
    if(!form.title.trim()){alert('Vui lÃ²ng nháº­p tÃªn váº¥n Ä‘á»!');return}
    if(form.status==='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&!form.resolution.trim()){alert('Báº¯t buá»™c nháº­p phÆ°Æ¡ng Ã¡n chá»‘t!');return}
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      if(editing){
        const old=decisions.find(d=>d.id===editing);
        await fbDb.collection('decisions').doc(editing).set(form,{merge:true});
        try{playSound('success');}catch(e){}
        if(old&&old.status!=='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&form.status==='ÄÃ£ chá»‘t chÃ­nh thá»©c'){
          try{addNotification(`âœ… Váº¥n Ä‘á» "${form.title}" Ä‘Ã£ chá»‘t chÃ­nh thá»©c!`,'success');}catch(e){}
          triggerMascot('gavel','âš–ï¸ ÄÃ£ chá»‘t chÃ­nh thá»©c!');
        }
      }else{
        const id=uid();
        const newD={...form,id,poll:{options:[],locked:false},createdAt:new Date().toISOString()};
        await fbDb.collection('decisions').doc(id).set(newD);
        try{playSound('success');}catch(e){}
        if(form.status==='ÄÃ£ chá»‘t chÃ­nh thá»©c'){
          try{addNotification(`âœ… Váº¥n Ä‘á» "${form.title}" Ä‘Ã£ chá»‘t!`,'success');}catch(e){}
          triggerMascot('gavel','âš–ï¸ ÄÃ£ chá»‘t!');
        }else{
          triggerMascot('write','ðŸ“ Váº¥n Ä‘á» má»›i ghi nháº­n!');
        }
      }
      handleClose();
    }catch(err){
      console.error('Lá»—i lÆ°u quyáº¿t Ä‘á»‹nh:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleStatusChange=async(d,ns)=>{
    if(ns==='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&!d.resolution){openEdit({...d,status:ns});return}
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('decisions').doc(d.id).set({status:ns},{merge:true});
      try{playSound('pop');}catch(e){}
      if(ns==='ÄÃ£ chá»‘t chÃ­nh thá»©c'){
        try{addNotification(`âœ… "${d.title}" Ä‘Ã£ chá»‘t!`,'success');}catch(e){}
        triggerMascot('gavel','âš–ï¸ ÄÃ£ chá»‘t chÃ­nh thá»©c!');
      }
    }catch(err){
      console.error('Lá»—i Ä‘á»•i tráº¡ng thÃ¡i:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const addPollOption=async(dId)=>{
    const txt=(pollInput[dId]||'').trim();
    if(!txt)return;
    const d=decisions.find(x=>x.id===dId);
    if(!d)return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const poll=d.poll||{options:[],locked:false};
      const updatedPoll={...poll,options:[...poll.options,{id:uid(),text:txt,votes:0}]};
      await fbDb.collection('decisions').doc(dId).set({poll:updatedPoll},{merge:true});
      setPollInput(p=>({...p,[dId]:''}));
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i thÃªm phÆ°Æ¡ng Ã¡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const vote=async(dId,optId)=>{
    const d=decisions.find(x=>x.id===dId);
    if(!d||(d.poll&&d.poll.locked))return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const poll=d.poll||{options:[],locked:false};
      const updatedPoll={...poll,options:poll.options.map(o=>o.id===optId?{...o,votes:(o.votes||0)+1}:o)};
      await fbDb.collection('decisions').doc(dId).set({poll:updatedPoll},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i bá» phiáº¿u:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const lockPoll=(dId)=>{
    const d=decisions.find(x=>x.id===dId);
    if(!d||!d.poll||d.poll.options.length===0)return;
    const winner=d.poll.options.reduce((a,b)=>(b.votes||0)>(a.votes||0)?b:a,d.poll.options[0]);
    openEdit({...d,resolution:winner.text,poll:{...d.poll,locked:true}});
  };
  const delPollOpt=async(dId,optId)=>{
    const d=decisions.find(x=>x.id===dId);
    if(!d)return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const poll=d.poll||{options:[],locked:false};
      const updatedPoll={...poll,options:poll.options.filter(o=>o.id!==optId)};
      await fbDb.collection('decisions').doc(dId).set({poll:updatedPoll},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a phÆ°Æ¡ng Ã¡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const handleDeleteDecision=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('decisions').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ xÃ³a váº¥n Ä‘á»','info');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a quyáº¿t Ä‘á»‹nh:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  let filtered=decisions;
  if(filterBan)filtered=filtered.filter(d=>d.ban===filterBan);
  if(filterStatus)filtered=filtered.filter(d=>d.status===filterStatus);

  function PollSection({d}){
    const poll=d.poll||{options:[],locked:false};
    const total=poll.options.reduce((s,o)=>s+(o.votes||0),0);
    const maxVotes=Math.max(...poll.options.map(o=>o.votes||0),0);
    return(
      <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
            <Icon name="bar-chart-2" size={13}/>Biá»ƒu Quyáº¿t Nhanh
            {poll.locked&&<span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full">ðŸ”’ ÄÃ£ khÃ³a</span>}
          </p>
          {!poll.locked&&maxVotes>0&&poll.options.length>1&&(
            <button onClick={()=>lockPoll(d.id)} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2.5 py-1 font-semibold">Chá»‘t phÆ°Æ¡ng Ã¡n tháº¯ng</button>
          )}
        </div>
        <div className="space-y-2 mb-2.5">
          {poll.options.map(opt=>{
            const pct=total>0?Math.round((opt.votes||0)/total*100):0;
            const isLeading=maxVotes>0&&(opt.votes||0)===maxVotes;
            return(
              <div key={opt.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-medium ${isLeading?'text-indigo-700':'text-slate-700'}`}>{isLeading&&total>0?'ðŸ† ':''}{opt.text}</span>
                    <span className="text-slate-500 ml-2 flex-shrink-0">{opt.votes||0} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
                    <div className={`h-2 rounded-full transition-all duration-500 ${isLeading&&total>0?'bg-indigo-500':'bg-slate-300'}`} style={{width:`${pct}%`}}/>
                  </div>
                </div>
                {!poll.locked&&<button onClick={()=>vote(d.id,opt.id)} className="flex-shrink-0 w-8 h-8 bg-white border-2 border-indigo-200 rounded-lg text-sm hover:bg-indigo-50 transition font-bold text-indigo-600">+1</button>}
                {!poll.locked&&<button onClick={()=>delPollOpt(d.id,opt.id)} className="flex-shrink-0 p-1 hover:bg-red-50 rounded text-red-400"><Icon name="x" size={12}/></button>}
              </div>
            );
          })}
          {poll.options.length===0&&<p className="text-xs text-indigo-400 text-center py-3">ChÆ°a cÃ³ phÆ°Æ¡ng Ã¡n. ThÃªm Ä‘á»ƒ báº¯t Ä‘áº§u biá»ƒu quyáº¿t!</p>}
        </div>
        {!poll.locked&&d.status!=='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&(
          <div className="flex gap-2">
            <input value={pollInput[d.id]||''} onChange={e=>setPollInput(p=>({...p,[d.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addPollOption(d.id)} placeholder="Nháº­p tÃªn phÆ°Æ¡ng Ã¡n..." className="flex-1 text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:border-indigo-400"/>
            <button onClick={()=>addPollOption(d.id)} className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg px-3 font-semibold">ThÃªm</button>
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Sá»• Quyáº¿t Äá»‹nh & Biá»ƒu Quyáº¿t</h1><p className="text-xs text-slate-500 mt-0.5">Theo dÃµi, biá»ƒu quyáº¿t nhanh vÃ  chá»‘t phÆ°Æ¡ng Ã¡n chÃ­nh thá»©c</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="plus" size={15}/>ThÃªm má»›i</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={filterBan} onChange={e=>setFilterBan(e.target.value)} className="form-input text-sm w-auto">
          <option value="">Táº¥t cáº£ ban</option>
          {BANS.map(b=><option key={b}>{b}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="form-input text-sm w-auto">
          <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
          {DECISION_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        {(filterBan||filterStatus)&&<button onClick={()=>{setFilterBan('');setFilterStatus('')}} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"><Icon name="x-circle" size={13}/>XÃ³a lá»c</button>}
      </div>
      {filtered.length===0&&<div className="card py-16 text-center"><Icon name="file-text" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">ChÆ°a cÃ³ váº¥n Ä‘á» nÃ o Ä‘Æ°á»£c ghi nháº­n</p></div>}
      <div className="space-y-3">
        {filtered.map(d=>{
          const over=d.status!=='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&isOverdue(d.deadline);
          return(
            <div key={d.id} className={`card p-4 fade-in ${over?'overdue':''}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`status-badge ${statusColor(d.status)}`}>{d.status}</span>
                    {d.ban&&<span className="status-badge tag-gray text-xs">{d.ban}</span>}
                    {over&&<span className="status-badge tag-red text-xs">âš  QuÃ¡ háº¡n</span>}
                  </div>
                  <h3 className="font-bold text-slate-800 mt-1">{d.title}</h3>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    {d.proposer&&<span className="flex items-center gap-1"><Icon name="user" size={11}/>Äá» xuáº¥t: <b className="text-slate-700">{d.proposer}</b></span>}
                    {d.pic&&<span className="flex items-center gap-1"><Icon name="user-check" size={11}/>PIC: <b className="text-slate-700">{d.pic}</b></span>}
                    {d.deadline&&<span className="flex items-center gap-1"><Icon name="calendar" size={11}/>Háº¡n: <b className={over?'text-red-600':'text-slate-700'}>{fmtDate(d.deadline)}</b></span>}
                  </div>
                  {d.resolution&&<div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800"><b>âœ… PhÆ°Æ¡ng Ã¡n chá»‘t:</b> {d.resolution}</div>}
                  {d.status!=='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&<PollSection d={d}/>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <select value={d.status} onChange={e=>handleStatusChange(d,e.target.value)} className="form-input text-xs py-1 px-2 w-auto">
                    {DECISION_STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                  <button onClick={()=>openEdit(d)} className="p-2 rounded-lg hover:bg-slate-100"><Icon name="pencil" size={14} className="text-slate-400"/></button>
                  <button onClick={()=>setConfirmDel(d.id)} className="p-2 rounded-lg hover:bg-red-50"><Icon name="trash-2" size={14} className="text-red-400"/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={modal} onClose={handleClose} title={editing?'Chá»‰nh sá»­a váº¥n Ä‘á»':'Ghi nháº­n váº¥n Ä‘á» má»›i'}>
        <div className="space-y-4">
          <div><label className="form-label">Váº¥n Ä‘á» / Äá» xuáº¥t <span className="text-red-500">*</span></label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="MÃ´ táº£ ngáº¯n gá»n váº¥n Ä‘á» hoáº·c Ä‘á» xuáº¥t..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">NgÆ°á»i Ä‘á» xuáº¥t</label><input value={form.proposer} onChange={e=>setForm(p=>({...p,proposer:e.target.value}))} className="form-input" placeholder="TÃªn ngÆ°á»i Ä‘á» xuáº¥t"/></div>
            <div><label className="form-label">Ban liÃªn quan</label><select value={form.ban} onChange={e=>setForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chá»n ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">PIC â€“ NgÆ°á»i chá»‹u trÃ¡ch nhiá»‡m</label><input value={form.pic} onChange={e=>setForm(p=>({...p,pic:e.target.value}))} className="form-input" placeholder="TÃªn ngÆ°á»i phá»¥ trÃ¡ch"/></div>
            <div><label className="form-label">Háº¡n pháº£n há»“i</label><input type="date" value={form.deadline} onChange={e=>setForm(p=>({...p,deadline:e.target.value}))} className="form-input"/></div>
          </div>
          <div><label className="form-label">Tráº¡ng thÃ¡i</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-input">{DECISION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="form-label">PhÆ°Æ¡ng Ã¡n chá»‘t cuá»‘i cÃ¹ng {form.status==='ÄÃ£ chá»‘t chÃ­nh thá»©c'&&<span className="text-red-500">*</span>}</label><textarea value={form.resolution} onChange={e=>setForm(p=>({...p,resolution:e.target.value}))} className="form-input min-h-[80px] resize-none" placeholder={form.status==='ÄÃ£ chá»‘t chÃ­nh thá»©c'?'Báº¯t buá»™c â€“ ghi rÃµ phÆ°Æ¡ng Ã¡n...':'Ghi láº¡i phÆ°Æ¡ng Ã¡n Ä‘Ã£ thá»‘ng nháº¥t...'}/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'LÆ°u thay Ä‘á»•i':'Ghi nháº­n'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>handleDeleteDecision(confirmDel)} message="Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a váº¥n Ä‘á» nÃ y?"/>
    </div>
  );
}

// ============================================================
// TASK ROW
// ============================================================
function TaskRow({task,onToggle,onEdit,onDelete}){
  const{triggerCat,isInitialSnapshot,adminMode,userIdentity}=useContext(AppCtx);
  const over=!task.done&&isOverdue(task.deadline);
  const soon=!task.done&&!over&&isSoon(task.deadline);

  const isAssignedToOther = !adminMode && task.assignee && userIdentity && task.assignee.trim().toLowerCase() !== userIdentity.trim().toLowerCase();
  const canEdit = adminMode || (userIdentity && task.assignee && task.assignee.trim().toLowerCase() === userIdentity.trim().toLowerCase()) || (!task.assignee);
  const canDelete = adminMode;

  const handleToggle=()=>{
    if(isAssignedToOther){
      alert(`Äáº§u viá»‡c nÃ y do ${task.assignee} Ä‘áº£m nháº­n!`);
      return;
    }
    if(!task.done && !isInitialSnapshot)triggerCat('celebrate');
    onToggle(task.id);
  };

  return(
    <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-white group transition ${over?'overdue':soon?'deadline-soon':''} ${task.done?'opacity-60':''}`}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={handleToggle}
        className="w-4 h-4 accent-orange-600 cursor-pointer flex-shrink-0"
        title={isAssignedToOther ? `Äáº§u viá»‡c nÃ y do ${task.assignee} Ä‘áº£m nháº­n` : ''}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.done?'line-through text-slate-400':'text-slate-800'}`}>{task.title}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {task.assignee&&<span className="text-xs text-slate-500 flex items-center gap-0.5"><Icon name="user" size={11}/>{task.assignee}</span>}
          {task.ban&&<span className="status-badge tag-gray text-[11px]">{task.ban}</span>}
          {task.deadline&&<span className={`status-badge text-[11px] ${over?'tag-red':soon?'tag-yellow':'tag-gray'}`}><Icon name="clock" size={10}/>&nbsp;{fmtDate(task.deadline)}{over?' âš ':soon?' â°':''}</span>}
          {task.link&&<a href={task.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"><Icon name="link" size={10}/>Link</a>}
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        {canEdit && <button onClick={()=>onEdit(task)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Chá»‰nh sá»­a"><Icon name="pencil" size={13} className="text-slate-400"/></button>}
        {canDelete && <button onClick={()=>onDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="XÃ³a"><Icon name="trash-2" size={13} className="text-red-400"/></button>}
      </div>
    </div>
  );
}

// ============================================================
// LIVE EVENT MODE â€“ Cháº¿ Ä‘á»™ Thá»±c Äá»‹a
// ============================================================
function LiveEventMode({event,onBack,onUpdate}){
  const{addNotification,triggerMascot}=useContext(AppCtx);
  const[sosModal,setSosModal]=useState(false);
  const[sosText,setSosText]=useState('');

  const ld=event.liveData||{venueChecks:{},incidents:[]};

  const toggleVenue=itemId=>{
    const nc={...ld.venueChecks,[itemId]:!ld.venueChecks[itemId]};
    onUpdate({...event,liveData:{...ld,venueChecks:nc}});
  };

  const addSOS=()=>{
    if(!sosText.trim())return;
    const inc={id:uid(),time:new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),desc:sosText.trim(),resolved:false};
    onUpdate({...event,liveData:{...ld,incidents:[inc,...(ld.incidents||[])]}});
    try{addNotification(`ðŸš¨ SOS táº¡i "${event.name}": ${sosText.slice(0,60)}`,'error');}catch(e){}
    triggerMascot('sos','ðŸš¨ SOS! Äang xá»­ lÃ½ sá»± cá»‘!');
    setSosText('');setSosModal(false);
  };

  const resolveInc=incId=>{
    onUpdate({...event,liveData:{...ld,incidents:(ld.incidents||[]).map(i=>i.id===incId?{...i,resolved:true}:i)}});
  };

  const checkedCount=DEFAULT_VENUE_ITEMS.filter(i=>ld.venueChecks[i.id]).length;
  const tasks=event.tasks||[];
  const openInc=(ld.incidents||[]).filter(i=>!i.resolved);

  return(
    <div className="min-h-screen" style={{background:'#0f172a'}}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{background:'#1e293b',borderBottom:'1px solid #334155'}}>
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-700 transition"><Icon name="arrow-left" size={20} className="text-white"/></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" style={{animation:'pulseRed 1s ease-in-out infinite'}}/>
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">âš¡ LIVE EVENT MODE</span>
            </div>
            <h1 className="text-base font-bold text-white truncate">{event.name}</h1>
          </div>
          <button onClick={()=>setSosModal(true)} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl px-3 py-2 font-bold text-sm shadow-lg transition flex-shrink-0">
            <Icon name="siren" size={16}/>SOS
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
        {openInc.length>0&&(
          <div className="sos-flash rounded-2xl border border-red-800 p-3">
            <p className="text-red-300 font-bold text-sm mb-2 flex items-center gap-2"><Icon name="alert-octagon" size={16} className="text-red-400"/>ðŸš¨ {openInc.length} Sá»° Cá» ÄANG Má»ž</p>
            {openInc.map(i=>(
              <div key={i.id} className="flex items-center gap-2 bg-red-950/40 rounded-xl p-2.5 mb-1">
                <p className="flex-1 text-red-200 text-sm font-semibold">{i.desc}</p>
                <span className="text-red-400 text-xs flex-shrink-0">{i.time}</span>
                <button onClick={()=>resolveInc(i.id)} className="flex-shrink-0 text-xs bg-emerald-700 text-white rounded-lg px-2 py-1 hover:bg-emerald-600">âœ“</button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl p-4" style={{background:'#1e293b',border:'1px solid #334155'}}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white flex items-center gap-2"><Icon name="clipboard-check" size={16} className="text-indigo-400"/>Check-in Háº¡ng Má»¥c</h2>
            <span className="text-sm font-bold" style={{color:checkedCount===DEFAULT_VENUE_ITEMS.length?'#34d399':'#818cf8'}}>{checkedCount}/{DEFAULT_VENUE_ITEMS.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_VENUE_ITEMS.map(item=>{
              const checked=ld.venueChecks[item.id];
              return(
                <button key={item.id} onClick={()=>toggleVenue(item.id)} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition text-left ${checked?'border-emerald-500':'border-slate-600 hover:border-slate-500'}`} style={{background:checked?'rgba(16,185,129,0.1)':'rgba(30,41,59,0.8)'}}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition ${checked?'bg-emerald-500':'bg-slate-700'}`}>
                    {checked?<Icon name="check" size={14} className="text-white"/>:<Icon name={item.icon} size={13} className="text-slate-400"/>}
                  </div>
                  <span className={`text-sm font-medium ${checked?'text-emerald-300':'text-slate-300'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{background:'#1e293b',border:'1px solid #334155'}}>
          <h2 className="font-bold text-white flex items-center gap-2 mb-3">
            <Icon name="git-branch" size={16} className="text-indigo-400"/>Timeline CÃ´ng Viá»‡c
            {tasks.filter(t=>!t.done).length>0&&<span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">{tasks.filter(t=>!t.done).length} chá» xá»­ lÃ½</span>}
          </h2>
          {tasks.length===0?<p className="text-slate-500 text-sm text-center py-4">ChÆ°a cÃ³ Ä‘áº§u viá»‡c nÃ o</p>:(
            <div className="space-y-2.5">
              {[...tasks].reverse().map(t=>(
                <div key={t.id} className={`flex items-start gap-3 pl-4 border-l-2 ${t.done?'border-emerald-600':'border-indigo-600'}`}>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 -ml-5 mt-1 border-2 ${t.done?'bg-emerald-500 border-emerald-500':'bg-slate-800 border-indigo-500'}`}/>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${t.done?'line-through text-slate-500':'text-white'}`}>{t.title}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs" style={{color:'#94a3b8'}}>
                      {t.assignee&&<span>ðŸ‘¤ {t.assignee}</span>}
                      {t.deadline&&<span>â° {new Date(t.deadline).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span>}
                      <span style={{color:t.phase===TASK_PHASES[0]?'#818cf8':'#34d399'}}>{t.phase}</span>
                    </div>
                  </div>
                  <div className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${t.done?'bg-emerald-900 text-emerald-300':'bg-indigo-900 text-indigo-300'}`}>{t.done?'âœ“ Xong':'Äang lÃ m'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {(ld.incidents||[]).filter(i=>i.resolved).length>0&&(
          <div className="rounded-2xl p-4" style={{background:'#1e293b',border:'1px solid #334155'}}>
            <h2 className="font-bold text-slate-400 flex items-center gap-2 mb-3 text-sm"><Icon name="check-circle" size={14}/>Sá»± Cá»‘ ÄÃ£ Xá»­ LÃ½</h2>
            {(ld.incidents||[]).filter(i=>i.resolved).map(i=>(
              <div key={i.id} className="flex items-center gap-2 py-1.5 text-slate-500 text-sm">
                <span>âœ…</span><span className="line-through flex-1">{i.desc}</span><span className="text-xs">{i.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {sosModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)'}}>
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{background:'#1a0000',border:'2px solid #7f1d1d'}}>
            <div className="text-center mb-4">
              <p className="text-5xl mb-2">ðŸš¨</p>
              <h3 className="text-xl font-bold text-red-300">BÃ¡o Sá»± Cá»‘ Kháº©n Cáº¥p</h3>
              <p className="text-red-400/80 text-sm mt-1">MÃ´ táº£ nhanh sá»± cá»‘ Ä‘ang xáº£y ra táº¡i hiá»‡n trÆ°á»ng</p>
            </div>
            <textarea value={sosText} onChange={e=>setSosText(e.target.value)} className="w-full rounded-xl p-3 text-white text-sm resize-none min-h-[90px] outline-none" style={{background:'rgba(239,68,68,0.1)',border:'1px solid #7f1d1d'}} placeholder="VD: Máº¥t nguá»“n loa há»‡ thá»‘ng... / Thiáº¿u 20 gháº¿ khu A..."/>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>{setSosModal(false);setSosText('')}} className="flex-1 py-2.5 rounded-xl font-medium text-sm" style={{border:'1px solid #7f1d1d',color:'#fca5a5'}}>Há»§y</button>
              <button onClick={addSOS} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{background:'#dc2626'}}>ðŸš¨ Gá»­i BÃ¡o CÃ¡o SOS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// EVENT DETAIL
// ============================================================
function EventDetail({event,onBack}){
  const{events,setEvents,addNotification,triggerMascot,isInitialSnapshot,members,userIdentity,adminMode,studyResources,resources}=useContext(AppCtx);
  const[dupWarning,setDupWarning]=useState(null);
  const[taskModal,setTaskModal]=useState(false);
  const[editingTask,setEditingTask]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const[liveMode,setLiveMode]=useState(false);
  const[taskBanFilter,setTaskBanFilter]=useState('');
  const[myTasksOnly,setMyTasksOnly]=useState(false);
  const emptyTask={title:'',assignee:'',ban:'',deadline:'',link:'',phase:TASK_PHASES[0],done:false};
  const[taskForm,setTaskForm]=useState(emptyTask);

  const curEvent=events.find(e=>e.id===event.id)||event;
  const openAddTask=phase=>{setEditingTask(null);setTaskForm({...emptyTask,phase});setTaskModal(true)};
  const openEditTask=t=>{setEditingTask(t.id);setTaskForm({...t});setTaskModal(true)};
  const handleTaskClose=()=>{setTaskModal(false);setEditingTask(null)};

  const handleTaskSave=async(forceSave=false)=>{
    if(!taskForm.title.trim()){alert('Vui lÃ²ng nháº­p tÃªn cÃ´ng viá»‡c!');return}
    if(taskForm.link&&taskForm.link.trim()&&!forceSave){
      const dup = await checkDuplicateLinkAsync(taskForm.link, editingTask, { studyResources, resources, events });
      if(dup){
        setDupWarning({
          creator: dup.creator,
          onConfirm: ()=>{
            setDupWarning(null);
            handleTaskSave(true);
          }
        });
        return;
      }
    }
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      let updatedTasks;
      let savedTask;
      if(editingTask){
        savedTask={...taskForm,id:editingTask};
        updatedTasks=(curEvent.tasks||[]).map(t=>t.id===editingTask?{...t,...taskForm}:t);
      }else{
        savedTask={...taskForm,id:uid(),createdAt:new Date().toISOString()};
        updatedTasks=[...(curEvent.tasks||[]),savedTask];
        if(taskForm.assignee.trim()){
          try{addNotification(`ðŸ“‹ ÄÃ£ giao viá»‡c "${taskForm.title}" cho ${taskForm.assignee}`,'info');}catch(e){}
          triggerMascot('write',`ðŸ“‹ Giao cho ${taskForm.assignee}!`);
        }else{
          triggerMascot('write','ðŸ“ Äáº§u viá»‡c má»›i!');
        }
      }
      // Ghi cáº­p nháº­t trá»±c tiáº¿p vÃ o document cá»§a Sá»± kiá»‡n trÃªn Firestore
      await fbDb.collection('events').doc(curEvent.id).set({tasks:updatedTasks},{merge:true});
      // Äá»“ng thá»i cáº­p nháº­t hoáº·c thÃªm vÃ o collection tasks Ä‘á»™c láº­p
      try{
        await fbDb.collection('tasks').doc(savedTask.id).set({
          ...savedTask,
          eventId:curEvent.id,
          eventName:curEvent.name||''
        },{merge:true});
      }catch(e){
        console.warn('Sync to tasks collection notice:',e);
      }
      try{
        try{playSound('success');}catch(e){}
      }catch(e){
        console.warn('playSound error:',e);
      }
      handleTaskClose();
    }catch(err){
      console.error('Lá»—i lÆ°u cÃ´ng viá»‡c sá»± kiá»‡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const toggleTask=async(taskId)=>{
    const task=(curEvent.tasks||[]).find(t=>t.id===taskId);
    if(!task)return;
    const newDone=!task.done;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const updatedTasks=(curEvent.tasks||[]).map(t=>t.id===taskId?{...t,done:newDone}:t);
      await fbDb.collection('events').doc(curEvent.id).set({tasks:updatedTasks},{merge:true});
      try{
        await fbDb.collection('tasks').doc(taskId).set({done:newDone},{merge:true});
      }catch(e){}
      try{
        try{playSound('pop');}catch(e){}
      }catch(e){}
      if(newDone){
        try{addNotification(`âœ… HoÃ n thÃ nh: "${task.title}"`,'success');}catch(e){}
        if(!isInitialSnapshot)triggerMascot('celebrate','ðŸŽ‰ Xuáº¥t sáº¯c!');
      }else{
        try{addNotification(`ðŸ”„ Má»Ÿ láº¡i: "${task.title}"`,'warning');}catch(e){}
      }
    }catch(err){
      console.error('Lá»—i Ä‘á»•i tráº¡ng thÃ¡i cÃ´ng viá»‡c:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const deleteTask=async(taskId)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const updatedTasks=(curEvent.tasks||[]).filter(t=>t.id!==taskId);
      await fbDb.collection('events').doc(curEvent.id).set({tasks:updatedTasks},{merge:true});
      try{
        await fbDb.collection('tasks').doc(taskId).delete();
      }catch(e){}
      try{
        try{playSound('pop');}catch(e){}
      }catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a cÃ´ng viá»‡c:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const updateLiveData=async(updEv)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('events').doc(updEv.id).set(updEv,{merge:true});
    }catch(err){
      console.error('Lá»—i lÆ°u Live Event:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const tasksByPhase=phase=>(curEvent.tasks||[]).filter(t=>{
    if(t.phase!==phase)return false;
    if(myTasksOnly){
      if(!t.assignee||!userIdentity||!t.assignee.toLowerCase().includes(userIdentity.toLowerCase()))return false;
    }
    if(!taskBanFilter)return true;
    const b=(t.ban||'').toLowerCase();
    if(taskBanFilter==='Ná»™i vá»¥')return b.includes('ná»™i vá»¥');
    if(taskBanFilter==='Truyá»n thÃ´ng')return b.includes('truyá»n thÃ´ng');
    if(taskBanFilter==='Sá»± kiá»‡n')return b.includes('sá»± kiá»‡n');
    if(taskBanFilter==='Äá»‘i ngoáº¡i')return b.includes('Ä‘á»‘i ngoáº¡i');
    if(taskBanFilter==='ToÃ n CLB')return b.includes('toÃ n clb');
    return t.ban===taskBanFilter;
  });
  const totalTasks=(curEvent.tasks||[]).length;
  const doneTasks=(curEvent.tasks||[]).filter(t=>t.done).length;
  const progress=totalTasks>0?Math.round(doneTasks/totalTasks*100):0;

  if(liveMode)return<LiveEventMode event={curEvent} onBack={()=>setLiveMode(false)} onUpdate={updateLiveData}/>;

  return(
    <div className="space-y-4 fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition"><Icon name="arrow-left" size={20} className="text-slate-600"/></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">{curEvent.name}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-0.5">
            {curEvent.date&&<span className="flex items-center gap-1"><Icon name="calendar" size={11}/>{fmtDate(curEvent.date)}</span>}
            {curEvent.location&&<span className="flex items-center gap-1"><Icon name="map-pin" size={11}/>{curEvent.location}</span>}
          </div>
        </div>
        <button onClick={()=>setLiveMode(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 text-sm font-bold transition shadow-md flex-shrink-0">
          <Icon name="zap" size={15}/>âš¡ Thá»±c Äá»‹a
        </button>
      </div>

      {totalTasks>0&&(
        <div className="card p-3">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>Tiáº¿n Ä‘á»™ cÃ´ng viá»‡c</span>
            <span className="font-bold">{doneTasks}/{totalTasks} ({progress}%)</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-2.5 rounded-full transition-all duration-700 ${progress===100?'bg-emerald-500':'bg-indigo-500'}`} style={{width:`${progress}%`}}/>
          </div>
          {progress===100&&<p className="text-xs text-emerald-600 font-semibold mt-1.5 text-center">ðŸŽ‰ HoÃ n thÃ nh 100%!</p>}
        </div>
      )}

      {curEvent.note&&<div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800"><Icon name="sticky-note" size={14} className="inline mr-1.5"/>Ghi chÃº: {curEvent.note}</div>}

      {/* Bá»˜ Lá»ŒC BAN & VIá»†C Cá»¦A TÃ”I */}
      <div className="card p-3 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setMyTasksOnly(v => !v)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap flex items-center gap-1 ${
              myTasksOnly
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <span>âš¡</span> Viá»‡c cá»§a tÃ´i {userIdentity ? `(${userIdentity})` : ''}
          </button>

          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0 ml-1 mr-1">
            <Icon name="filter" size={12}/> Ban:
          </span>
          {['', 'Ná»™i vá»¥', 'Truyá»n thÃ´ng', 'Sá»± kiá»‡n', 'Äá»‘i ngoáº¡i', 'ToÃ n CLB'].map(b => (
            <button
              key={b}
              onClick={() => setTaskBanFilter(b)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                taskBanFilter === b
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {b || 'Táº¥t cáº£ ban'}
            </button>
          ))}
        </div>
        {(taskBanFilter || myTasksOnly) && (
          <button
            onClick={() => { setTaskBanFilter(''); setMyTasksOnly(false); }}
            className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 flex-shrink-0"
          >
            <Icon name="x-circle" size={12}/>XÃ³a lá»c
          </button>
        )}
      </div>

      {TASK_PHASES.map(phase=>{
        const phaseTasks = tasksByPhase(phase);
        const pendingTasks = phaseTasks.filter(t => !t.done);
        const completedTasks = phaseTasks.filter(t => t.done);
        return (
          <div key={phase} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${phase===TASK_PHASES[0]?'bg-blue-500':'bg-emerald-500'}`}/>
                {phase}
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{phaseTasks.length}</span>
              </h2>
              <button onClick={()=>openAddTask(phase)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={13}/>ThÃªm viá»‡c</button>
            </div>
            <div className="space-y-2">
              {phaseTasks.length===0&&<p className="text-xs text-slate-400 py-3 text-center">ChÆ°a cÃ³ Ä‘áº§u viá»‡c nÃ o trong giai Ä‘oáº¡n nÃ y</p>}
              {pendingTasks.map(t=><TaskRow key={t.id} task={t} onToggle={toggleTask} onEdit={openEditTask} onDelete={id=>setConfirmDel(id)}/>)}

              {completedTasks.length > 0 && (
                <details className="mt-3 pt-2 border-t border-slate-100">
                  <summary className="text-xs font-semibold text-slate-500 cursor-pointer py-1 select-none hover:text-slate-700 flex items-center gap-1">
                    <span>âœ… ÄÃ£ xong ({completedTasks.length})</span>
                  </summary>
                  <div className="space-y-2 mt-2">
                    {completedTasks.map(t=><TaskRow key={t.id} task={t} onToggle={toggleTask} onEdit={openEditTask} onDelete={id=>setConfirmDel(id)}/>)}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}

      <Modal open={taskModal} onClose={handleTaskClose} title={editingTask?'Chá»‰nh sá»­a cÃ´ng viá»‡c':'ThÃªm Ä‘áº§u viá»‡c má»›i'}>
        <div className="space-y-4">
          <div><label className="form-label">TÃªn cÃ´ng viá»‡c <span className="text-red-500">*</span></label><input value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="TÃªn cÃ´ng viá»‡c cáº§n lÃ m..."/></div>
          <div><label className="form-label">Giai Ä‘oáº¡n</label><select value={taskForm.phase} onChange={e=>setTaskForm(p=>({...p,phase:e.target.value}))} className="form-input">{TASK_PHASES.map(ph=><option key={ph}>{ph}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">NgÆ°á»i phá»¥ trÃ¡ch</label>
              <select
                value={taskForm.assignee}
                onChange={e=>setTaskForm(p=>({...p,assignee:e.target.value}))}
                className="form-input"
              >
                <option value="">-- Chá»n thÃ nh viÃªn --</option>
                {members.map(m=>(
                  <option key={m.id} value={m.name}>{m.name} ({m.ban || m.role || 'ThÃ nh viÃªn'})</option>
                ))}
              </select>
            </div>
            <div><label className="form-label">Ban phá»‘i há»£p</label><select value={taskForm.ban} onChange={e=>setTaskForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chá»n ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
          </div>
          <div><label className="form-label">Deadline</label><input type="datetime-local" value={taskForm.deadline} onChange={e=>setTaskForm(p=>({...p,deadline:e.target.value}))} className="form-input"/></div>
          <div><label className="form-label">Link tÃ i liá»‡u Ä‘Ã­nh kÃ¨m</label><input value={taskForm.link} onChange={e=>setTaskForm(p=>({...p,link:e.target.value}))} className="form-input" placeholder="https://drive.google.com/..."/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleTaskClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleTaskSave} className="btn-primary flex-1">{editingTask?'LÆ°u thay Ä‘á»•i':'ThÃªm viá»‡c'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>deleteTask(confirmDel)} message="XÃ³a Ä‘áº§u viá»‡c nÃ y?"/>
      <DuplicateLinkDialog open={!!dupWarning} creator={dupWarning?.creator} onCancel={()=>setDupWarning(null)} onConfirm={dupWarning?.onConfirm}/>
    </div>
  );
}

// ============================================================
// EVENTS PAGE
// ============================================================
function EventsPage(){
  const{events,setEvents,addNotification,playSound,adminMode}=useContext(AppCtx);
  const[selectedEvent,setSelectedEvent]=useState(null);
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const emptyForm={name:'',date:'',location:'',note:''};
  const[form,setForm]=useState(emptyForm);

  if(selectedEvent){
    const ev=events.find(e=>e.id===selectedEvent);
    if(ev)return<EventDetail event={ev} onBack={()=>setSelectedEvent(null)}/>;
    setSelectedEvent(null);
  }

  const openAdd=()=>{setEditing(null);setForm(emptyForm);setModal(true)};
  const openEdit=(e2,ev)=>{e2.stopPropagation();setEditing(ev.id);setForm({name:ev.name,date:ev.date,location:ev.location,note:ev.note});setModal(true)};
  const handleClose=()=>{setModal(false);setEditing(null)};
  const handleSave=async()=>{
    if(!form.name.trim()){alert('Vui lÃ²ng nháº­p tÃªn sá»± kiá»‡n!');return}
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      if(editing){
        await fbDb.collection('events').doc(editing).set(form,{merge:true});
        try{playSound('success');}catch(e){}
        try{addNotification(`ÄÃ£ cáº­p nháº­t sá»± kiá»‡n: ${form.name}`,'success');}catch(e){}
      }else{
        const id=uid();
        const newEv={...form,id,tasks:[],createdAt:new Date().toISOString()};
        await fbDb.collection('events').doc(id).set(newEv);
        try{playSound('success');}catch(e){}
        try{addNotification(`ÄÃ£ táº¡o sá»± kiá»‡n má»›i: ${form.name}`,'success');}catch(e){}
      }
      handleClose();
    }catch(err){
      console.error('Lá»—i lÆ°u sá»± kiá»‡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const handleDeleteEvent=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('events').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ xÃ³a sá»± kiá»‡n','info');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a sá»± kiá»‡n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const now=new Date();
  const upcoming=events.filter(e=>!e.date||new Date(e.date)>=now);
  const past=events.filter(e=>e.date&&new Date(e.date)<now);

  function EventCard({e}){
    const tasks=e.tasks||[];
    const done=tasks.filter(t=>t.done).length;
    const over=tasks.filter(t=>!t.done&&isOverdue(t.deadline)).length;
    return(
      <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow fade-in" onClick={()=>setSelectedEvent(e.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800">{e.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-500">
              {e.date&&<span className="flex items-center gap-1"><Icon name="calendar" size={11}/>{fmtDate(e.date)}</span>}
              {e.location&&<span className="flex items-center gap-1"><Icon name="map-pin" size={11}/>{e.location}</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{tasks.length} viá»‡c</span>
              {done>0&&<span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">âœ“ {done} xong</span>}
              {over>0&&<span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">âš  {over} quÃ¡ háº¡n</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={ev2=>ev2.stopPropagation()}>
            <button onClick={ev2=>openEdit(ev2,e)} className="p-2 rounded-lg hover:bg-slate-100" title="Sá»­a sá»± kiá»‡n"><Icon name="pencil" size={14} className="text-slate-400"/></button>
            {adminMode && <button onClick={()=>setConfirmDel(e.id)} className="p-2 rounded-lg hover:bg-red-50" title="XÃ³a sá»± kiá»‡n"><Icon name="trash-2" size={14} className="text-red-400"/></button>}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Äiá»u Phá»‘i Sá»± Kiá»‡n & Giao Viá»‡c</h1><p className="text-xs text-slate-500 mt-0.5">Quáº£n lÃ½ sá»± kiá»‡n, Ä‘áº§u viá»‡c vÃ  cháº¿ Ä‘á»™ thá»±c Ä‘á»‹a</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="plus" size={15}/>Táº¡o sá»± kiá»‡n</button>
      </div>
      {events.length===0&&<div className="card py-16 text-center"><Icon name="calendar-plus" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">ChÆ°a cÃ³ sá»± kiá»‡n nÃ o</p></div>}
      {upcoming.length>0&&<div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sáº¯p tá»›i & Äang diá»…n ra</p><div className="space-y-3">{upcoming.map(e=><EventCard key={e.id} e={e}/>)}</div></div>}
      {past.length>0&&<div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">ÄÃ£ qua</p><div className="space-y-3 opacity-70">{past.map(e=><EventCard key={e.id} e={e}/>)}</div></div>}
      <Modal open={modal} onClose={handleClose} title={editing?'Chá»‰nh sá»­a sá»± kiá»‡n':'Táº¡o sá»± kiá»‡n má»›i'}>
        <div className="space-y-4">
          <div><label className="form-label">TÃªn sá»± kiá»‡n <span className="text-red-500">*</span></label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-input" placeholder="TÃªn sá»± kiá»‡n..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">NgÃ y tá»• chá»©c</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-input"/></div>
            <div><label className="form-label">Äá»‹a Ä‘iá»ƒm</label><input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} className="form-input" placeholder="Giáº£ng Ä‘Æ°á»ng, phÃ²ng há»p..."/></div>
          </div>
          <div><label className="form-label">Ghi chÃº</label><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} className="form-input resize-none min-h-[72px]" placeholder="Ghi chÃº thÃªm..."/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'LÆ°u thay Ä‘á»•i':'Táº¡o sá»± kiá»‡n'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>handleDeleteEvent(confirmDel)} message="XÃ³a sá»± kiá»‡n vÃ  toÃ n bá»™ cÃ´ng viá»‡c bÃªn trong?"/>
    </div>
  );
}

// ============================================================
// MEMBER PROFILE MODAL â€“ Talent Hub
// ============================================================
function MemberProfileModal({member,open,onClose,sessions,assignTasks,events}){
  const totalSessions=sessions.length;
  const presentCount=sessions.filter(s=>member.attendance?.[s.id]==='CÃ³ máº·t').length;
  const attendancePct=totalSessions>0?Math.round(presentCount/totalSessions*100):null;
  const trackedTasks=assignTasks.filter(t=>member.taskStatus?.[t.id]);
  const onTimeCount=trackedTasks.filter(t=>member.taskStatus?.[t.id]==='ÄÃºng háº¡n').length;
  const taskPct=trackedTasks.length>0?Math.round(onTimeCount/trackedTasks.length*100):null;
  const assignedEventTasks=events.flatMap(e=>(e.tasks||[]).filter(t=>t.assignee&&t.assignee.toLowerCase().includes(member.name.toLowerCase())).map(t=>({...t,eventName:e.name})));
  const doneEventTasks=assignedEventTasks.filter(t=>t.done).length;
  const skills=member.skills||[];

  const kpcfg=(pct)=>pct===null?{c1:'#94a3b8',c2:'#64748b'}:pct>=80?{c1:'#059669',c2:'#0f766e'}:pct>=60?{c1:'#d97706',c2:'#c2410c'}:{c1:'#dc2626',c2:'#991b1b'};

  return(
    <Modal open={open} onClose={onClose} title="Há»“ SÆ¡ NÄƒng Lá»±c ThÃ nh ViÃªn" wide>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-lg">{member.name.charAt(0).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-slate-800">{member.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className={`status-badge text-xs ${member.role==='Ban Chá»§ Nhiá»‡m'?'tag-blue':member.role==='CTV'?'tag-gray':'tag-green'}`}>{member.role}</span>
              {member.ban&&<span className="status-badge tag-gray text-xs">{member.ban}</span>}
              {member.khoa&&<span className="status-badge tag-purple text-xs">{member.khoa}</span>}
              {member.lopHup&&<span className="status-badge tag-blue text-xs">{member.lopHup}</span>}
              <span className={`status-badge text-xs ${evalColor(member.eval||'Äáº¡t')}`}>{member.eval||'Äáº¡t'}</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
              {member.phone&&<span>ðŸ“ž {member.phone}</span>}
              {member.email&&<span>âœ‰ï¸ {member.email}</span>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ðŸ“Š Chá»‰ sá»‘ tá»± Ä‘á»™ng (KPI)</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:'% Äi há»p',val:attendancePct!==null?`${attendancePct}%`:'â€”',sub:`${presentCount}/${totalSessions} buá»•i`,...kpcfg(attendancePct)},
              {label:'% ÄÃºng háº¡n',val:taskPct!==null?`${taskPct}%`:'â€”',sub:`${onTimeCount}/${trackedTasks.length} bÃ i táº­p`,...kpcfg(taskPct)},
              {label:'Viá»‡c sá»± kiá»‡n',val:assignedEventTasks.length,sub:`âœ“ ${doneEventTasks} hoÃ n thÃ nh`,c1:'#4f46e5',c2:'#7c3aed'},
            ].map((k,i)=>(
              <div key={i} className="kpi-card" style={{'--kc1':k.c1,'--kc2':k.c2}}>
                <p className="text-xs font-medium opacity-80 mb-1">{k.label}</p>
                <p className="text-2xl font-black">{k.val}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {skills.length>0&&(
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ðŸŽ¯ Tháº¿ máº¡nh chuyÃªn mÃ´n</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map(s=><span key={s} className="status-badge tag-purple text-xs">{s}</span>)}
            </div>
          </div>
        )}

        {assignedEventTasks.length>0&&(
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ðŸ“‹ CÃ´ng viá»‡c sá»± kiá»‡n Ä‘Ã£/Ä‘ang phá»¥ trÃ¡ch</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {assignedEventTasks.map(t=>(
                <div key={t.id} className={`flex items-center gap-2.5 p-2 rounded-lg ${t.done?'bg-emerald-50':'bg-blue-50'}`}>
                  <span className="flex-shrink-0">{t.done?'âœ…':'ðŸ”µ'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${t.done?'text-emerald-700 line-through':'text-slate-700'}`}>{t.title}</p>
                    <p className="text-[10px] text-slate-400">{t.eventName}</p>
                  </div>
                  {t.deadline&&<span className="text-[10px] text-slate-400 flex-shrink-0">{fmtDate(t.deadline)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {member.note&&(
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-600 mb-1">ðŸ’¬ Nháº­n xÃ©t thÃ¡i Ä‘á»™</p>
            <p className="text-sm text-amber-800 italic">"{member.note}"</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={()=>{
            const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tháº» ÄÃ¡nh GiÃ¡ - ${member.name}</title>
<style>
body{font-family:'Segoe UI',sans-serif;padding:32px;color:#1e293b;background:#f8fafc}
.card{background:#fff;border:2px solid #4f46e5;border-radius:16px;padding:28px;max-width:580px;margin:0 auto;box-shadow:0 10px 25px rgba(0,0,0,0.08)}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;margin-right:6px;background:#e0e7ff;color:#4338ca}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}
.kpi-box{background:#f1f5f9;border-radius:12px;padding:12px;text-align:center}
.kpi-val{font-size:22px;font-weight:800;color:#1e293b;margin:4px 0}
.tag{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;margin:2px;background:#f3e8ff;color:#7e22ce}
.note{background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:10px;margin-top:16px;color:#92400e;font-style:italic}
@media print{body{padding:0;background:#fff}.card{border:1px solid #666;box-shadow:none}}
</style></head><body>
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:14px;margin-bottom:16px">
    <div>
      <h3 style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#6366f1">CLB Ká»¹ NÄƒng Má»m NewVision â€“ ÄH DÆ°á»£c HN</h3>
      <h1 style="margin:4px 0 0;font-size:24px;font-weight:900;color:#0f172a">${member.name}</h1>
    </div>
    <span class="badge" style="font-size:14px;padding:4px 12px;background:#dcfce7;color:#15803d">${member.eval||'Äáº¡t'}</span>
  </div>
  <div style="font-size:13px;color:#64748b;margin-bottom:12px">
    <span>${member.role}</span> Â· <span>${member.ban||'ToÃ n CLB'}</span> Â· <span>${member.khoa||''}</span>
    ${member.phone?` Â· ðŸ“ž ${member.phone}`:''}
  </div>
  <div class="kpi-row">
    <div class="kpi-box"><div style="font-size:11px;color:#64748b">% Äi Há»p</div><div class="kpi-val">${attendancePct!==null?attendancePct+'%':'â€”'}</div><div style="font-size:10px;color:#94a3b8">${presentCount}/${totalSessions} buá»•i</div></div>
    <div class="kpi-box"><div style="font-size:11px;color:#64748b">% ÄÃºng Háº¡n</div><div class="kpi-val">${taskPct!==null?taskPct+'%':'â€”'}</div><div style="font-size:10px;color:#94a3b8">${onTimeCount}/${trackedTasks.length} bÃ i</div></div>
    <div class="kpi-box"><div style="font-size:11px;color:#64748b">Viá»‡c Sá»± Kiá»‡n</div><div class="kpi-val">${assignedEventTasks.length}</div><div style="font-size:10px;color:#94a3b8">${doneEventTasks} hoÃ n thÃ nh</div></div>
  </div>
  ${skills.length>0?`<div style="margin-top:14px"><strong style="font-size:12px;color:#475569">Tháº¿ máº¡nh chuyÃªn mÃ´n:</strong><div style="margin-top:6px">${skills.map(s=>`<span class="tag">${s}</span>`).join('')}</div></div>`:''}
  ${member.note?`<div class="note"><strong>Nháº­n xÃ©t thÃ¡i Ä‘á»™:</strong> "${member.note}"</div>`:''}
  <div style="margin-top:20px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">
    <span>NewVision HUP Talent Profile</span>
    <span>NgÃ y xuáº¥t: ${new Date().toLocaleDateString('vi-VN')}</span>
  </div>
</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
            const w=window.open('','_blank');
            if(w){w.document.write(html);w.document.close()}
          }} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
            <Icon name="printer" size={14}/>Xuáº¥t Tháº» ÄÃ¡nh GiÃ¡ CÃ¡ NhÃ¢n
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MEMBERS PAGE
// ============================================================
function MembersPage(){
  const{members,setMembers,sessions,setSessions,assignTasks,setAssignTasks,events,triggerCat,addNotification,playSound,adminMode,userIdentity}=useContext(AppCtx);
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const[selectedBan,setSelectedBan]=useState('');
  const[searchKhoaLop,setSearchKhoaLop]=useState('');
  const[sessionModal,setSessionModal]=useState(false);
  const[taskModal,setTaskModal]=useState(false);
  const[newSession,setNewSession]=useState('');
  const[newATask,setNewATask]=useState('');
  const[viewMode,setViewMode]=useState('members');
  const[profileMember,setProfileMember]=useState(null);
  const emptyForm={name:'',role:'ThÃ nh viÃªn chÃ­nh thá»©c',ban:'',gen:'',lopHup:'',khoa:'',phone:'',email:'',note:'',eval:'Äáº¡t',skills:[],attendance:{},taskStatus:{}};
  const[form,setForm]=useState(emptyForm);

  const openAdd=()=>{setEditing(null);setForm(emptyForm);setModal(true)};
  const openEdit=m=>{setEditing(m.id);setForm({...emptyForm,...m,gen:m.gen||m.khoa||'',lopHup:m.lopHup||'',skills:m.skills||[]});setModal(true)};
  const handleClose=()=>{setModal(false);setEditing(null)};

  const handleSave=async()=>{
    if(!form.name.trim()){alert('Vui lÃ²ng nháº­p há» tÃªn!');return}
    const finalKhoa=form.gen?(form.lopHup?`${form.gen} Â· ${form.lopHup}`:form.gen):(form.lopHup||form.khoa||'');
    const memberData={...form,khoa:finalKhoa};
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      if(editing){
        await fbDb.collection('members').doc(editing).set(memberData,{merge:true});
        try{playSound('success');}catch(e){}
        try{addNotification(`ÄÃ£ cáº­p nháº­t thÃ´ng tin: ${form.name}`,'success');}catch(e){}
      }else{
        // Kiá»ƒm tra xem thÃ nh viÃªn nÃ y Ä‘Ã£ tá»“n táº¡i chÆ°a Ä‘á»ƒ trÃ¡nh táº¡o trÃ¹ng láº·p
        const existing = members.find(m => (m.name||'').trim().toLowerCase() === form.name.trim().toLowerCase() && (m.ban||'').trim() === (form.ban||'').trim());
        const id = existing ? existing.id : uid();
        const newDoc={
          ...memberData,
          id,
          attendance: existing?.attendance || {},
          taskStatus: existing?.taskStatus || {},
          createdAt: existing?.createdAt || new Date().toISOString()
        };
        await fbDb.collection('members').doc(id).set(newDoc, {merge:true});
        try{playSound('success');}catch(e){}
        try{triggerCat('dash');}catch(e){}
        try{addNotification(`ÄÃ£ thÃªm thÃ nh viÃªn má»›i: ${form.name}`,'success');}catch(e){}
      }
      handleClose();
    }catch(err){
      console.error('Lá»—i lÆ°u thÃ nh viÃªn:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const toggleSkill=skill=>{
    const cur=form.skills||[];
    setForm(p=>({...p,skills:cur.includes(skill)?cur.filter(s=>s!==skill):[...cur,skill]}));
  };

  const setAttend=async(mId,sId,val)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const m=members.find(x=>x.id===mId);
      const curAtt=m?.attendance||{};
      await fbDb.collection('members').doc(mId).set({attendance:{...curAtt,[sId]:val}},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i lÆ°u Ä‘iá»ƒm danh:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const setTaskStat=async(mId,tId,val)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const m=members.find(x=>x.id===mId);
      const curStat=m?.taskStatus||{};
      await fbDb.collection('members').doc(mId).set({taskStatus:{...curStat,[tId]:val}},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i lÆ°u bÃ i táº­p:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const setNote=async(mId,note)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('members').doc(mId).set({note},{merge:true});
    }catch(err){
      console.error('Lá»—i lÆ°u ghi chÃº:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const setEval=async(mId,val)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('members').doc(mId).set({eval:val},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i lÆ°u Ä‘Ã¡nh giÃ¡:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const addSession=async()=>{
    if(!newSession.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const id=uid();
      await fbDb.collection('sessions').doc(id).set({id,name:newSession.trim(),createdAt:new Date().toISOString()});
      setNewSession('');
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i thÃªm buá»•i sinh hoáº¡t:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const deleteSession=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('sessions').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a buá»•i sinh hoáº¡t:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const addATask=async()=>{
    if(!newATask.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const id=uid();
      await fbDb.collection('assignTasks').doc(id).set({id,name:newATask.trim(),createdAt:new Date().toISOString()});
      setNewATask('');
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i thÃªm nhiá»‡m vá»¥:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const deleteATask=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('assignTasks').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a nhiá»‡m vá»¥:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };
  const handleDeleteMember=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('members').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ xÃ³a thÃ nh viÃªn','info');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a thÃ nh viÃªn:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  // Khá»­ trÃ¹ng láº·p thÃ nh viÃªn trÆ°á»›c khi duyá»‡t máº£ng Ä‘á»ƒ render giao diá»‡n
  const uniqueMembers = useMemo(()=>{
    const seenIds = new Set();
    const seenNames = new Set();
    const cleanList = [];
    (members || []).forEach(m => {
      if(!m || !m.id) return;
      if(seenIds.has(m.id)) return;
      seenIds.add(m.id);
      const nameKey = (m.name || '').trim().toLowerCase() + '|' + (m.ban || '').trim() + '|' + (m.khoa || m.gen || '').trim();
      if(nameKey && seenNames.has(nameKey)) return;
      if(nameKey) seenNames.add(nameKey);
      cleanList.push(m);
    });
    return cleanList;
  },[members]);

  const bans=[...new Set(uniqueMembers.map(m=>m.ban||'ChÆ°a phÃ¢n ban'))];
  let filteredMembers=uniqueMembers;
  if(selectedBan)filteredMembers=filteredMembers.filter(m=>(m.ban||'ChÆ°a phÃ¢n ban')===selectedBan);
  if(searchKhoaLop.trim()){
    const q=searchKhoaLop.trim().toLowerCase();
    filteredMembers=filteredMembers.filter(m=>
      (m.gen&&m.gen.toLowerCase().includes(q))||
      (m.lopHup&&m.lopHup.toLowerCase().includes(q))||
      (m.khoa&&m.khoa.toLowerCase().includes(q))||
      (m.name&&m.name.toLowerCase().includes(q))
    );
  }
  const groupedByBan=bans.reduce((acc,b)=>({...acc,[b]:filteredMembers.filter(m=>(m.ban||'ChÆ°a phÃ¢n ban')===b)}),{});

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">ThÃ nh ViÃªn & CTV NewVision HUP</h1><p className="text-xs text-slate-500 mt-0.5">Há»“ sÆ¡ nÄƒng lá»±c, cháº¥m cÃ´ng vÃ  Ä‘Ã¡nh giÃ¡ tá»•ng káº¿t</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="user-plus" size={15}/>ThÃªm má»›i</button>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['members','Danh sÃ¡ch'],['attendance','Cháº¥m cÃ´ng'],['tasks','BÃ i táº­p']].map(([v,l])=>(
          <button key={v} onClick={()=>setViewMode(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode===v?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={selectedBan} onChange={e=>setSelectedBan(e.target.value)} className="form-input text-sm w-auto">
          <option value="">Táº¥t cáº£ ban</option>
          {bans.map(b=><option key={b}>{b}</option>)}
        </select>
        <div className="relative flex-1 min-w-[210px] max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            type="text"
            value={searchKhoaLop}
            onChange={e=>setSearchKhoaLop(e.target.value)}
            className="form-input text-sm pl-8 pr-7 py-1.5 w-full"
            placeholder="TÃ¬m theo KhÃ³a, Gen hoáº·c Lá»›p..."
          />
          {searchKhoaLop&&(
            <button onClick={()=>setSearchKhoaLop('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <Icon name="x" size={12}/>
            </button>
          )}
        </div>
        {(selectedBan||searchKhoaLop)&&(
          <button onClick={()=>{setSelectedBan('');setSearchKhoaLop('')}} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
            <Icon name="x-circle" size={13}/>XÃ³a lá»c
          </button>
        )}
        {viewMode==='attendance'&&<button onClick={()=>setSessionModal(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={12}/>ThÃªm buá»•i</button>}
        {viewMode==='tasks'&&<button onClick={()=>setTaskModal(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={12}/>ThÃªm bÃ i táº­p</button>}
      </div>

      {members.length===0&&<div className="card py-16 text-center"><Icon name="users" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">ChÆ°a cÃ³ thÃ nh viÃªn nÃ o</p></div>}

      {viewMode==='members'&&(
        <div className="space-y-4">
          {Object.entries(groupedByBan).map(([ban,mems])=>(
            <div key={ban}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="flex-shrink-0">{ban}</span>
                <span className="flex-1 h-px bg-slate-200"/>
                <span className="flex-shrink-0 bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full text-[11px]">{mems.length}</span>
              </p>
              <div className="space-y-2">
                {mems.map(m=>(
                  <div key={m.id} className="card p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer" onClick={()=>setProfileMember(m)}>
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow">{m.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                        <span className={`status-badge text-[11px] ${m.role==='Ban Chá»§ Nhiá»‡m'?'tag-blue':m.role==='CTV'?'tag-gray':'tag-green'}`}>{m.role}</span>
                        {(m.gen||m.khoa)&&<span className="status-badge tag-purple text-[11px]">{m.gen||m.khoa}</span>}
                        {m.lopHup&&<span className="status-badge tag-blue text-[11px]">{m.lopHup}</span>}
                        <span className={`status-badge text-[11px] ${evalColor(m.eval||'Äáº¡t')}`}>{m.eval||'Äáº¡t'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-slate-400">
                        {m.phone&&<span>ðŸ“ž {m.phone}</span>}
                        {(m.skills||[]).length>0&&<span className="text-indigo-400">{(m.skills||[]).slice(0,2).join(' Â· ')}{(m.skills||[]).length>2?` +${(m.skills||[]).length-2}`:''}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                      <select value={m.eval||'Äáº¡t'} onChange={e=>setEval(m.id,e.target.value)} disabled={!adminMode} className="form-input text-xs py-1 px-1.5 w-auto">{EVAL_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>
                      {(adminMode || (userIdentity && m.name && m.name.trim().toLowerCase() === userIdentity.trim().toLowerCase())) && (
                        <button onClick={()=>openEdit(m)} className="p-2 rounded-lg hover:bg-slate-100" title="Chá»‰nh sá»­a há»“ sÆ¡"><Icon name="pencil" size={14} className="text-slate-400"/></button>
                      )}
                      {adminMode && (
                        <button onClick={()=>setConfirmDel(m.id)} className="p-2 rounded-lg hover:bg-red-50" title="XÃ³a thÃ nh viÃªn"><Icon name="trash-2" size={14} className="text-red-400"/></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredMembers.length>0&&(
            <div className="card p-4">
              <h3 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><Icon name="message-square" size={15} className="text-indigo-500"/>Ghi chÃº nháº­n xÃ©t thÃ¡i Ä‘á»™</h3>
              <div className="space-y-2">
                {filteredMembers.map(m=>(
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{m.name.charAt(0)}</div>
                    <p className="text-xs font-medium text-slate-700 w-28 flex-shrink-0 truncate">{m.name}</p>
                    <input value={m.note||''} onChange={e=>setNote(m.id,e.target.value)} placeholder="Nháº­n xÃ©t thÃ¡i Ä‘á»™ lÃ m viá»‡c..." className="form-input flex-1 text-xs py-1.5"/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode==='attendance'&&(
        <div className="card overflow-x-auto">
          {sessions.length===0?(
            <div className="py-12 text-center"><Icon name="calendar-x" size={36} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">ThÃªm buá»•i sinh hoáº¡t Ä‘á»ƒ báº¯t Ä‘áº§u Ä‘iá»ƒm danh</p></div>
          ):(
            <table className="w-full text-sm min-w-max">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left p-3 font-semibold text-slate-700 sticky left-0 bg-white min-w-[140px]">ThÃ nh viÃªn</th>
                {sessions.map(s=><th key={s.id} className="p-3 font-semibold text-slate-700 text-center min-w-[130px]">
                  <div className="flex items-center justify-between gap-1"><span className="truncate text-xs">{s.name}</span><button onClick={()=>deleteSession(s.id)} className="text-red-300 hover:text-red-500"><Icon name="x" size={12}/></button></div>
                </th>)}
              </tr></thead>
              <tbody>
                {filteredMembers.map(m=>(
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-3 sticky left-0 bg-white hover:bg-slate-50">
                      <p className="font-medium text-slate-800 text-xs">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.ban||'â€”'}</p>
                    </td>
                    {sessions.map(s=>(
                      <td key={s.id} className="p-2 text-center">
                        <select value={m.attendance?.[s.id]||''} onChange={e=>setAttend(m.id,s.id,e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-1 py-1 bg-white w-full">
                          <option value="">â€”</option>
                          {ATTEND_OPTIONS.map(o=><option key={o}>{o}</option>)}
                        </select>
                        {m.attendance?.[s.id]&&<span className={`status-badge text-[10px] mt-1 ${attendColor(m.attendance[s.id])}`}>{m.attendance[s.id]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {viewMode==='tasks'&&(
        <div className="card overflow-x-auto">
          {assignTasks.length===0?(
            <div className="py-12 text-center"><Icon name="file-x" size={36} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">ThÃªm bÃ i táº­p/nhiá»‡m vá»¥ Ä‘á»ƒ theo dÃµi tiáº¿n Ä‘á»™</p></div>
          ):(
            <table className="w-full text-sm min-w-max">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left p-3 font-semibold text-slate-700 sticky left-0 bg-white min-w-[140px]">ThÃ nh viÃªn</th>
                {assignTasks.map(t=><th key={t.id} className="p-3 font-semibold text-slate-700 text-center min-w-[130px]">
                  <div className="flex items-center justify-between gap-1"><span className="truncate text-xs">{t.name}</span><button onClick={()=>deleteATask(t.id)} className="text-red-300 hover:text-red-500"><Icon name="x" size={12}/></button></div>
                </th>)}
              </tr></thead>
              <tbody>
                {filteredMembers.map(m=>(
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-3 sticky left-0 bg-white hover:bg-slate-50">
                      <p className="font-medium text-slate-800 text-xs">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.ban||'â€”'}</p>
                    </td>
                    {assignTasks.map(t=>(
                      <td key={t.id} className="p-2 text-center">
                        <select value={m.taskStatus?.[t.id]||''} onChange={e=>setTaskStat(m.id,t.id,e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-1 py-1 bg-white w-full">
                          <option value="">â€”</option>
                          {TASK_OPTIONS.map(o=><option key={o}>{o}</option>)}
                        </select>
                        {m.taskStatus?.[t.id]&&<span className={`status-badge text-[10px] mt-1 ${taskColor(m.taskStatus[t.id])}`}>{m.taskStatus[t.id]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {profileMember&&<MemberProfileModal member={profileMember} open={!!profileMember} onClose={()=>setProfileMember(null)} sessions={sessions} assignTasks={assignTasks} events={events}/>}

      <Modal open={modal} onClose={handleClose} title={editing?'Chá»‰nh sá»­a thÃ nh viÃªn':'ThÃªm thÃ nh viÃªn / CTV má»›i'}>
        <div className="space-y-4">
          <div><label className="form-label">Há» vÃ  tÃªn <span className="text-red-500">*</span></label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-input" placeholder="Há» vÃ  tÃªn Ä‘áº§y Ä‘á»§"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Vai trÃ²</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="form-input">{MEMBER_ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
            <div><label className="form-label">Ban</label><select value={form.ban} onChange={e=>setForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chá»n ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">KhÃ³a / Gen CLB</label>
              <input
                value={form.gen||form.khoa||''}
                onChange={e=>setForm(p=>({...p,gen:e.target.value}))}
                className="form-input"
                placeholder="VD: Gen 17, K17, Gen 18..."
              />
            </div>
            <div>
              <label className="form-label">Lá»›p / KhÃ³a trÆ°á»ng HUP</label>
              <input
                value={form.lopHup||''}
                onChange={e=>setForm(p=>({...p,lopHup:e.target.value}))}
                className="form-input"
                placeholder="VD: A4K80, A1K79, S1K3..."
              />
            </div>
          </div>
          <div><label className="form-label">ÄÃ¡nh giÃ¡ tá»•ng káº¿t</label><select value={form.eval} onChange={e=>setForm(p=>({...p,eval:e.target.value}))} className="form-input">{EVAL_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Sá»‘ Ä‘iá»‡n thoáº¡i</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="form-input" placeholder="0912345678"/></div>
            <div><label className="form-label">Email</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="form-input" placeholder="email@example.com"/></div>
          </div>
          <div>
            <label className="form-label">Tháº¿ máº¡nh chuyÃªn mÃ´n</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SKILL_TAGS.map(s=>(
                <button key={s} type="button" onClick={()=>toggleSkill(s)} className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${(form.skills||[]).includes(s)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div><label className="form-label">Ghi chÃº thÃ¡i Ä‘á»™</label><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} className="form-input resize-none min-h-[60px]" placeholder="Ghi chÃº nháº­n xÃ©t..."/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'LÆ°u thay Ä‘á»•i':'ThÃªm thÃ nh viÃªn'}</button></div>
        </div>
      </Modal>

      <Modal open={sessionModal} onClose={()=>setSessionModal(false)} title="Quáº£n lÃ½ buá»•i sinh hoáº¡t">
        <div className="space-y-3">
          <div className="flex gap-2"><input value={newSession} onChange={e=>setNewSession(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSession()} className="form-input flex-1" placeholder="VD: Há»p Ban tuáº§n 1 thÃ¡ng 10..."/><button onClick={addSession} className="btn-primary px-4">ThÃªm</button></div>
          <div className="space-y-1 max-h-48 overflow-y-auto">{sessions.map(s=><div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><span className="text-sm">{s.name}</span><button onClick={()=>deleteSession(s.id)} className="text-red-400 hover:text-red-600"><Icon name="trash-2" size={14}/></button></div>)}{sessions.length===0&&<p className="text-sm text-slate-400 text-center py-4">ChÆ°a cÃ³ buá»•i nÃ o</p>}</div>
          <button onClick={()=>setSessionModal(false)} className="btn-secondary w-full">ÄÃ³ng</button>
        </div>
      </Modal>

      <Modal open={taskModal} onClose={()=>setTaskModal(false)} title="Quáº£n lÃ½ bÃ i táº­p / nhiá»‡m vá»¥">
        <div className="space-y-3">
          <div className="flex gap-2"><input value={newATask} onChange={e=>setNewATask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addATask()} className="form-input flex-1" placeholder="VD: BÃ i táº­p ká»¹ nÄƒng tuáº§n 1..."/><button onClick={addATask} className="btn-primary px-4">ThÃªm</button></div>
          <div className="space-y-1 max-h-48 overflow-y-auto">{assignTasks.map(t=><div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><span className="text-sm">{t.name}</span><button onClick={()=>deleteATask(t.id)} className="text-red-400 hover:text-red-600"><Icon name="trash-2" size={14}/></button></div>)}{assignTasks.length===0&&<p className="text-sm text-slate-400 text-center py-4">ChÆ°a cÃ³ bÃ i táº­p nÃ o</p>}</div>
          <button onClick={()=>setTaskModal(false)} className="btn-secondary w-full">ÄÃ³ng</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>handleDeleteMember(confirmDel)} message="XÃ³a thÃ nh viÃªn vÃ  toÃ n bá»™ dá»¯ liá»‡u liÃªn quan?"/>
    </div>
  );
}

// ============================================================
// ADMIN LOCK (Máº¬T KHáº¨ QUáº¢N TRá»Š 1072)
// ============================================================
function AdminLock({onUnlock}){
  const[pin,setPin]=useState('');
  const[err,setErr]=useState(false);
  const{playSound,addNotification}=useContext(AppCtx);

  const handleSubmit=e=>{
    if(e&&e.preventDefault)e.preventDefault();
    if(pin.trim()==='1072'){
      try{playSound('success');}catch(e){}
      try{addNotification('ðŸ‘‘ ÄÃ£ xÃ¡c thá»±c quyá»n Quáº£n trá»‹ BCN thÃ nh cÃ´ng!','success');}catch(e){}
      onUnlock();
    }else{
      try{playSound('pop');}catch(e){}
      setErr(true);
      setTimeout(()=>setErr(false),2500);
    }
  };

  return(
    <div className="card max-w-md mx-auto my-12 p-6 sm:p-8 text-center space-y-4 shadow-xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-b from-white to-amber-50/30 dark:from-slate-800 dark:to-slate-900">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
        <Icon name="lock" size={32}/>
      </div>
      <div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Khu Vá»±c Quáº£n Trá»‹ BCN</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Ná»™i dung nÃ y Ä‘Æ°á»£c báº£o máº­t ná»™i bá»™. Vui lÃ²ng nháº­p mÃ£ quáº£n trá»‹ Ä‘á»ƒ má»Ÿ khÃ³a.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
        <div>
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={e=>setPin(e.target.value)}
            placeholder="Nháº­p mÃ£ quáº£n trá»‹..."
            className={`form-input text-center text-xl tracking-widest font-mono font-bold ${err?'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700':''}`}
            autoFocus
          />
          {err&&<p className="text-xs text-red-500 font-semibold mt-1.5 animate-shake">MÃ£ quáº£n trá»‹ khÃ´ng Ä‘Ãºng. Vui lÃ²ng thá»­ láº¡i!</p>}
        </div>
        <button type="submit" className="btn-primary w-full py-2.5 font-bold text-sm shadow-md flex items-center justify-center gap-2">
          <Icon name="key" size={16}/> Má»Ÿ KhÃ³a Truy Cáº­p
        </button>
      </form>
    </div>
  );
}

// ============================================================
// ADMIN LOGIN MODAL
// ============================================================
function AdminLoginModal({isOpen,onClose,onUnlock}){
  const[pin,setPin]=useState('');
  const[err,setErr]=useState(false);
  const{playSound,addNotification}=useContext(AppCtx);

  const handleCheck=e=>{
    if(e&&e.preventDefault)e.preventDefault();
    if(pin.trim()==='1072'){
      try{playSound('success');}catch(e){}
      try{addNotification('ðŸ‘‘ ÄÃ£ kÃ­ch hoáº¡t Cháº¿ Ä‘á»™ Quáº£n trá»‹ BCN','success');}catch(e){}
      onUnlock();
      onClose();
      setPin('');
    }else{
      try{playSound('pop');}catch(e){}
      setErr(true);
      setTimeout(()=>setErr(false),2500);
    }
  };

  return(
    <Modal open={isOpen} onClose={onClose} title="ÄÄƒng Nháº­p Quáº£n Trá»‹ BCN">
      <form onSubmit={handleCheck} className="space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Ná»™i dung nÃ y Ä‘Æ°á»£c báº£o máº­t ná»™i bá»™. Vui lÃ²ng nháº­p mÃ£ quáº£n trá»‹ Ä‘á»ƒ má»Ÿ khÃ³a.
        </p>
        <div>
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={e=>setPin(e.target.value)}
            placeholder="Nháº­p mÃ£ quáº£n trá»‹..."
            className={`form-input text-center text-xl tracking-widest font-mono font-bold ${err?'border-red-500 bg-red-50 text-red-700':''}`}
            autoFocus
          />
          {err&&<p className="text-xs text-red-500 font-semibold mt-1.5 text-center">MÃ£ quáº£n trá»‹ khÃ´ng chÃ­nh xÃ¡c!</p>}
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Há»§y</button>
          <button type="submit" className="btn-primary flex-1 font-bold">XÃ¡c Nháº­n</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// GACHA CARD MODAL (3D FLIP ORACLE)
// ============================================================
function GachaModal({isOpen,onClose}){
  const{playSound,triggerMascot}=useContext(AppCtx);
  const todayStr=useMemo(()=>new Date().toISOString().slice(0,10),[]);
  const[flipped,setFlipped]=useState(false);
  const[cardIndex,setCardIndex]=useState(null);

  useEffect(()=>{
    if(!isOpen)return;
    const savedDate=localStorage.getItem('nv_last_gacha_date');
    const savedIdx=localStorage.getItem('nv_last_gacha_card');
    if(savedDate===todayStr&&savedIdx!==null){
      setCardIndex(parseInt(savedIdx,10));
      setFlipped(true);
    }else{
      setFlipped(false);
      setCardIndex(null);
    }
  },[isOpen,todayStr]);

  const drawCard=()=>{
    if(flipped)return;
    const randIdx=Math.floor(Math.random()*GACHA_CARDS.length);
    setCardIndex(randIdx);
    setFlipped(true);
    localStorage.setItem('nv_last_gacha_date',todayStr);
    localStorage.setItem('nv_last_gacha_card',randIdx.toString());
    try{playSound('success');}catch(e){}
    try{triggerMascot('celebrate','âœ¨ Quáº» lÃ nh hÃ´m nay!');}catch(e){}
  };

  const card=cardIndex!==null?GACHA_CARDS[cardIndex]:null;

  return(
    <Modal open={isOpen} onClose={onClose} title="ðŸŽ´ Gieo Quáº» HÃ´m Nay - NewVision Oracle">
      <div className="flex flex-col items-center justify-center py-4 space-y-4">
        <p className="text-xs text-slate-500 text-center max-w-sm">
          Má»—i ngÃ y má»™t thÃ´ng Ä‘iá»‡p vÅ© trá»¥ dÃ nh riÃªng cho báº¡n. Cháº¡m vÃ o lÃ¡ bÃ i Ä‘á»ƒ láº­t quáº»!
        </p>

        <div className="perspective-1000 w-64 h-96 cursor-pointer" onClick={drawCard}>
          <div className={`gacha-card-inner relative w-full h-full rounded-2xl shadow-2xl transform-style-3d ${flipped?'rotate-y-180 gacha-glow':''}`}>
            {/* Card Back */}
            <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 border-2 border-amber-400/60 p-5 flex flex-col items-center justify-between text-white select-none">
              <div className="w-full flex justify-between text-amber-300 text-xs font-mono"><span>âœ¦</span><span>NEWVISION HUP</span><span>âœ¦</span></div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full border-2 border-amber-300/40 flex items-center justify-center bg-indigo-950/60 shadow-[0_0_20px_rgba(251,191,36,0.35)]">
                  <span className="text-4xl animate-pulse">ðŸ”®</span>
                </div>
                <p className="text-sm font-bold text-amber-200 tracking-wider">CHáº M Äá»‚ RÃšT QUáºº</p>
                <p className="text-[10px] text-slate-400">1 quáº» duy nháº¥t má»—i ngÃ y</p>
              </div>
              <div className="w-full flex justify-between text-amber-300 text-xs font-mono"><span>âœ¦</span><span>HUYá»€N Há»ŒC & TAROT</span><span>âœ¦</span></div>
            </div>

            {/* Card Front */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-orange-50 border-2 border-amber-500 p-5 flex flex-col justify-between text-slate-800 select-none shadow-xl">
              {card?(
                <>
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{card.code}</span>
                  </div>
                  <div className="my-auto text-center space-y-2 py-2">
                    <h3 className="font-black text-lg text-amber-900">{card.title}</h3>
                    <div className="h-0.5 w-12 bg-amber-400 mx-auto rounded-full"/>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-medium px-1">
                      "{card.quote}"
                    </p>
                  </div>
                  <div className="pt-2 border-t border-amber-200/80 text-center">
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      â˜… Quáº» ngÃ y {todayStr}
                    </span>
                  </div>
                </>
              ):null}
            </div>
          </div>
        </div>

        {flipped&&(
          <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <Icon name="check-circle" size={13}/> ÄÃ£ ghi nháº­n quáº» hÃ´m nay cá»§a báº¡n!
          </p>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// ============================================================
// VIETNAMESE POPULAR BANKS FOR VIETQR
// ============================================================
const POPULAR_BANKS = [
  { code: 'MB', name: 'MB Bank (QuÃ¢n Äá»™i)' },
  { code: 'VCB', name: 'Vietcombank (Ngoáº¡i ThÆ°Æ¡ng)' },
  { code: 'TCB', name: 'Techcombank (Ká»¹ ThÆ°Æ¡ng)' },
  { code: 'VPB', name: 'VPBank (Viá»‡t Nam Thá»‹nh VÆ°á»£ng)' },
  { code: 'TPB', name: 'TPBank (TiÃªn Phong)' },
  { code: 'ICB', name: 'VietinBank (CÃ´ng ThÆ°Æ¡ng)' },
  { code: 'BIDV', name: 'BIDV (Äáº§u TÆ° & PhÃ¡t Triá»ƒn)' },
  { code: 'ACB', name: 'ACB (Ã ChÃ¢u)' },
  { code: 'STB', name: 'Sacombank (SÃ i GÃ²n ThÆ°Æ¡ng TÃ­n)' },
  { code: 'HDB', name: 'HDBank (PhÃ¡t Triá»ƒn TP.HCM)' },
  { code: 'VIB', name: 'VIB (Quá»‘c Táº¿)' },
  { code: 'SHB', name: 'SHB (SÃ i GÃ²n - HÃ  Ná»™i)' },
  { code: 'MSB', name: 'MSB (HÃ ng Háº£i)' },
  { code: 'OCB', name: 'OCB (PhÆ°Æ¡ng ÄÃ´ng)' },
  { code: 'LPB', name: 'LPBank (Lá»™c PhÃ¡t)' },
  { code: 'SEAB', name: 'SeABank (ÄÃ´ng Nam Ã)' }
];

// ============================================================
// VIETQR MODAL
// ============================================================
function VietQRModal({ isOpen, onClose, penalty }) {
  const { playSound, addNotification, penaltyAccount } = useContext(AppCtx);
  const [copied, setCopied] = useState(false);
  if (!isOpen || !penalty) return null;

  const isConfigured = !!(penaltyAccount && penaltyAccount.accountNo && penaltyAccount.accountNo.trim() && penaltyAccount.bank && penaltyAccount.bank.trim());

  if (!isConfigured) {
    return (
      <Modal open={isOpen} onClose={onClose} title="QuÃ©t MÃ£ VietQR Ná»™p Quá»¹">
        <div className="flex flex-col items-center py-6 px-4 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Icon name="alert-triangle" size={32} />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              BCN chÆ°a cáº¥u hÃ¬nh thÃ´ng tin chuyá»ƒn khoáº£n
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Ban Chá»§ Nhiá»‡m chÆ°a thiáº¿t láº­p sá»‘ tÃ i khoáº£n ngÃ¢n hÃ ng Ä‘á»ƒ nháº­n tiá»n ná»™p pháº¡t vÃ o quá»¹ CLB. Vui lÃ²ng liÃªn há»‡ BCN hoáº·c Quáº£n trá»‹ viÃªn má»Ÿ pháº§n cÃ i Ä‘áº·t tÃ i khoáº£n Ä‘á»ƒ cáº¥u hÃ¬nh.
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary px-6 py-2 text-xs font-bold rounded-xl">
            ÄÃ³ng
          </button>
        </div>
      </Modal>
    );
  }

  const amount = Math.abs(penalty.amount || 20000);
  const bankCode = penaltyAccount.bank.trim().toUpperCase();
  const accNo = penaltyAccount.accountNo.trim();
  const bankDisplay = penaltyAccount.bankName || bankCode;
  const hasCustomQr = !!(penaltyAccount.customQrUrl && penaltyAccount.customQrUrl.trim());

  const qrUrl = hasCustomQr
    ? penaltyAccount.customQrUrl.trim()
    : `https://img.vietqr.io/image/${bankCode}-${accNo}-compact.png?amount=${amount}&addInfo=NVPHAT%20${encodeURIComponent(penalty.name || '')}`;

  const copyInfo = () => {
    const namePart = penaltyAccount.accountName ? ` - Chu TK: ${penaltyAccount.accountName}` : '';
    const text = `${bankDisplay} - STK: ${accNo}${namePart} - So tien: ${amount.toLocaleString('vi-VN')}d - ND: NVPHAT ${penalty.name}`;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      try { playSound('pop'); } catch (e) {}
      try { addNotification('ÄÃ£ sao chÃ©p thÃ´ng tin chuyá»ƒn khoáº£n!', 'success'); } catch (e) {}
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="QuÃ©t MÃ£ VietQR Ná»™p Quá»¹">
      <div className="flex flex-col items-center space-y-4 py-2">
        <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
          <img
            src={qrUrl}
            alt="VietQR Chuyá»ƒn Khoáº£n"
            className="w-64 h-auto rounded-xl mx-auto max-h-72 object-contain"
            onError={e => {
              e.target.src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=NVPHAT%20' + encodeURIComponent(penalty.name || '');
            }}
          />
        </div>

        <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between">
            <span className="text-slate-500">NgÃ¢n hÃ ng:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{bankDisplay}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Sá»‘ tÃ i khoáº£n:</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{accNo}</span>
          </div>
          {penaltyAccount.accountName && (
            <div className="flex justify-between">
              <span className="text-slate-500">Chá»§ tÃ i khoáº£n:</span>
              <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{penaltyAccount.accountName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Sá»‘ tiá»n ná»™p:</span>
            <span className="font-bold text-amber-600">{amount.toLocaleString('vi-VN')} Ä‘</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Ná»™i dung CK:</span>
            <span className="font-mono font-bold text-emerald-600">NVPHAT {penalty.name}</span>
          </div>
        </div>

        <div className="flex gap-2 w-full pt-1">
          <button onClick={copyInfo} className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5">
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            <span>{copied ? 'ÄÃ£ sao chÃ©p' : 'Sao chÃ©p thÃ´ng tin'}</span>
          </button>
          <button onClick={onClose} className="btn-primary flex-1 py-2 text-xs font-bold">
            ÄÃ³ng
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Ná»˜I QUY & THÆ¯á»žNG PHáº T (PENALTIES & REWARDS MODULE)
// ============================================================
function PenaltiesPage() {
  const { penalties, setPenalties, adminMode, addNotification, playSound, members, clubRules, setClubRules, penaltyAccount, setPenaltyAccount } = useContext(AppCtx);
  const [subTab, setSubTab] = useState('penalties'); // 'penalties' | 'rules'
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [qrPenalty, setQrPenalty] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterBan, setFilterBan] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  // Bank settings state
  const [bankModal, setBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank: 'MB',
    bankName: 'MB Bank (QuÃ¢n Äá»™i)',
    accountNo: '',
    accountName: '',
    customQrUrl: ''
  });
  const [bankSaving, setBankSaving] = useState(false);

  const openBankModal = () => {
    if (penaltyAccount) {
      setBankForm({
        bank: penaltyAccount.bank || 'MB',
        bankName: penaltyAccount.bankName || 'MB Bank (QuÃ¢n Äá»™i)',
        accountNo: penaltyAccount.accountNo || '',
        accountName: penaltyAccount.accountName || '',
        customQrUrl: penaltyAccount.customQrUrl || ''
      });
    }
    setBankModal(true);
  };

  const handleSaveBank = async e => {
    if (e && e.preventDefault) e.preventDefault();
    if (!bankForm.accountNo.trim()) {
      alert('Vui lÃ²ng nháº­p sá»‘ tÃ i khoáº£n ngÃ¢n hÃ ng!');
      return;
    }
    setBankSaving(true);
    try {
      if (!fbDb) throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const cleanData = {
        bank: bankForm.bank.trim().toUpperCase(),
        bankName: bankForm.bankName.trim(),
        accountNo: bankForm.accountNo.trim(),
        accountName: bankForm.accountName.trim().toUpperCase(),
        customQrUrl: bankForm.customQrUrl.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin BCN'
      };
      await fbDb.collection('club_settings').doc('penalty_account').set(cleanData, { merge: true });
      if (setPenaltyAccount) setPenaltyAccount(cleanData);
      try { playSound('success'); } catch (err) {}
      try { addNotification('âœ… ÄÃ£ lÆ°u cáº¥u hÃ¬nh tÃ i khoáº£n ná»™p pháº¡t lÃªn Firestore!', 'success'); } catch (err) {}
      setBankModal(false);
    } catch (err) {
      alert('Lá»—i lÆ°u tÃ i khoáº£n: ' + err.message);
    } finally {
      setBankSaving(false);
    }
  };

  // Club rules editing state
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);

  const openEditRules = () => {
    setRulesDraft(clubRules || '');
    setEditingRules(true);
  };
  const handleSaveRules = async () => {
    setRulesSaving(true);
    try {
      if (!fbDb) throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('club_settings').doc('rules').set({
        content: rulesDraft,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin BCN'
      }, { merge: true });
      try { playSound('success'); } catch (e) {}
      try { addNotification('âœ… ÄÃ£ cáº­p nháº­t Ná»™i Quy CLB lÃªn Cloud Firestore!', 'success'); } catch (e) {}
      setEditingRules(false);
    } catch (err) {
      alert('Lá»—i lÆ°u Firebase: ' + err.message);
    } finally {
      setRulesSaving(false);
    }
  };

  const emptyForm = { name: '', ban: 'Ná»™i vá»¥', reason: '', amount: 20000, type: 'phat', status: 'Chá» ná»™p' };
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = item => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      ban: item.ban || 'Ná»™i vá»¥',
      reason: item.reason || '',
      amount: Math.abs(item.amount || 20000),
      type: item.type || (item.amount < 0 ? 'phat' : 'thuong'),
      status: item.status || 'Chá» ná»™p'
    });
    setModal(true);
  };

  const handleSave = async e => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.name.trim()) { alert('Vui lÃ²ng chá»n hoáº·c nháº­p tÃªn thÃ nh viÃªn!'); return; }
    if (!form.reason.trim()) { alert('Vui lÃ²ng nháº­p lÃ½ do!'); return; }
    try {
      if (!fbDb) throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const amountVal = form.type === 'thuong' ? Math.abs(form.amount) : -Math.abs(form.amount);

      if (editingId) {
        const updatedRec = {
          name: form.name.trim(),
          ban: form.ban,
          reason: form.reason.trim(),
          amount: amountVal,
          type: form.type,
          status: form.type === 'thuong' ? 'ÄÃ£ trao' : form.status,
          updatedAt: new Date().toISOString()
        };
        await fbDb.collection('penalties').doc(editingId).set(updatedRec, { merge: true });
        setPenalties(prev => prev.map(p => p.id === editingId ? { ...p, ...updatedRec } : p));
        try { playSound('success'); } catch (e) {}
        try { addNotification(`ÄÃ£ cáº­p nháº­t ${form.type === 'thuong' ? 'khen thÆ°á»Ÿng' : 'vi pháº¡m'}: ${form.name}`, 'success'); } catch (e) {}
      } else {
        const id = uid();
        const newRec = {
          id,
          name: form.name.trim(),
          ban: form.ban,
          reason: form.reason.trim(),
          amount: amountVal,
          type: form.type,
          status: form.type === 'thuong' ? 'ÄÃ£ trao' : form.status,
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString()
        };
        await fbDb.collection('penalties').doc(id).set(newRec);
        try { playSound('success'); } catch (e) {}
        try { addNotification(`ÄÃ£ ghi nháº­n ${form.type === 'thuong' ? 'khen thÆ°á»Ÿng' : 'vi pháº¡m'}: ${form.name}`, 'info'); } catch (e) {}
      }
      setModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      alert('Lá»—i lÆ°u Firebase: ' + err.message);
    }
  };

  const toggleStatus = async item => {
    if (!adminMode) {
      alert('Chá»‰ Ban Chá»§ Nhiá»‡m má»›i cÃ³ quyá»n duyá»‡t tráº¡ng thÃ¡i ná»™p pháº¡t!');
      return;
    }
    const newStatus = item.status === 'ÄÃ£ ná»™p' ? 'Chá» ná»™p' : 'ÄÃ£ ná»™p';
    try {
      if (!fbDb) throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('penalties').doc(item.id).set({ status: newStatus }, { merge: true });
      try { playSound('pop'); } catch (e) {}
      try { addNotification(`ÄÃ£ chuyá»ƒn tráº¡ng thÃ¡i sang "${newStatus}": ${item.name}`, 'success'); } catch (e) {}
    } catch (err) {
      alert('Lá»—i lÆ°u Firebase: ' + err.message);
    }
  };

  const handleDelete = async id => {
    if (!adminMode) {
      alert('Chá»‰ Ban Chá»§ Nhiá»‡m má»›i cÃ³ quyá»n xÃ³a báº£n ghi!');
      return;
    }
    try {
      if (!fbDb) throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('penalties').doc(id).delete();
      setPenalties(prev => prev.filter(p => p.id !== id));
      try { playSound('pop'); } catch (e) {}
      try { addNotification('ÄÃ£ xÃ³a vÄ©nh viá»…n báº£n ghi khá»i Cloud Firestore', 'info'); } catch (e) {}
      setConfirmDel(null);
    } catch (err) {
      alert('Lá»—i xÃ³a Firebase: ' + err.message);
    }
  };

  const filtered = (penalties || []).filter(item => {
    if (filterType === 'pending' && item.status !== 'Chá» ná»™p') return false;
    if (filterType === 'done' && item.status === 'Chá» ná»™p') return false;
    if (filterBan && item.ban !== filterBan) return false;
    return true;
  });

  const totalPending = (penalties || []).filter(p => p.status === 'Chá» ná»™p').reduce((acc, cur) => acc + Math.abs(cur.amount || 0), 0);
  const totalCollected = (penalties || []).filter(p => p.status === 'ÄÃ£ ná»™p' && p.amount < 0).reduce((acc, cur) => acc + Math.abs(cur.amount || 0), 0);

  return (
    <div className="space-y-4 fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Icon name="scale" size={20} className="text-orange-600" />
            Ná»™i Quy & ThÆ°á»Ÿng Pháº¡t CLB
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Theo dÃµi vi pháº¡m, ná»™p pháº¡t qua VietQR tá»± Ä‘á»™ng vÃ  vinh danh khen thÆ°á»Ÿng</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {adminMode && subTab === 'penalties' && (
            <button
              onClick={openBankModal}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="CÃ i Ä‘áº·t tÃ i khoáº£n ngÃ¢n hÃ ng nháº­n tiá»n pháº¡t ná»™p quá»¹"
            >
              <Icon name="settings" size={14} className="text-orange-600" />
              <span>âš™ï¸ CÃ i Ä‘áº·t tÃ i khoáº£n ná»™p pháº¡t</span>
            </button>
          )}
          {subTab === 'penalties' && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 shadow-sm">
              <Icon name="plus" size={15} /> Ghi nháº­n má»›i
            </button>
          )}
          {subTab === 'rules' && adminMode && !editingRules && (
            <button onClick={openEditRules} className="btn-primary flex items-center gap-1.5 shadow-sm">
              <Icon name="pencil" size={15} /> Chá»‰nh sá»­a ná»™i quy
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('penalties')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${subTab === 'penalties' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
        >
          âš–ï¸ ThÆ°á»Ÿng & Pháº¡t
        </button>
        <button
          onClick={() => setSubTab('rules')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${subTab === 'rules' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ðŸ“‹ Ná»™i Quy CLB
        </button>
      </div>

      {/* RULES SUB-TAB */}
      {subTab === 'rules' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
              <Icon name="book-open" size={18} className="text-indigo-500" />
              Quy Cháº¿ & Ná»™i Quy CLB NewVision HUP
            </h2>
            {adminMode && editingRules && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingRules(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={rulesSaving}
                >
                  Há»§y
                </button>
                <button
                  onClick={handleSaveRules}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  disabled={rulesSaving}
                >
                  {rulesSaving ? 'Äang lÆ°u...' : 'ðŸ’¾ LÆ°u ná»™i quy'}
                </button>
              </div>
            )}
          </div>

          {adminMode && editingRules ? (
            <div>
              <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                Nháº­p ná»™i quy theo tá»«ng dÃ²ng. DÃ¹ng "â€¢" hoáº·c "-" Ä‘áº§u dÃ²ng cho gáº¡ch Ä‘áº§u dÃ²ng. Ná»™i dung sáº½ Ä‘Æ°á»£c lÆ°u lÃªn Cloud vÃ  hiá»ƒn thá»‹ cho toÃ n CLB.
              </p>
              <textarea
                value={rulesDraft}
                onChange={e => setRulesDraft(e.target.value)}
                className="form-input w-full resize-y min-h-[320px] font-mono text-sm leading-relaxed"
                placeholder={"â€¢ Äiá»u 1: Táº¥t cáº£ thÃ nh viÃªn pháº£i tham dá»± há»p CLB Ä‘Ãºng giá».\nâ€¢ Äiá»u 2: HoÃ n thÃ nh nhiá»‡m vá»¥ Ä‘Æ°á»£c giao trÆ°á»›c deadline.\nâ€¢ Äiá»u 3: Äi muá»™n dÆ°á»›i 15 phÃºt pháº¡t 10.000Ä‘...\n\n(Nháº­p ná»™i quy cá»§a CLB báº¡n táº¡i Ä‘Ã¢y)"}
              />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              {clubRules ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 min-h-[120px]">
                  {clubRules}
                </pre>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Icon name="book-open" size={36} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-sm">ChÆ°a cÃ³ ná»™i quy CLB</p>
                  {adminMode ? (
                    <p className="text-xs mt-1">Báº¥m "Chá»‰nh sá»­a ná»™i quy" á»Ÿ trÃªn Ä‘á»ƒ soáº¡n tháº£o vÃ  lÆ°u lÃªn Cloud.</p>
                  ) : (
                    <p className="text-xs mt-1">Ná»™i quy CLB chÆ°a Ä‘Æ°á»£c thiáº¿t láº­p bá»Ÿi Ban Chá»§ Nhiá»‡m.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!adminMode && clubRules && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Icon name="info" size={11} /> Chá»‰ Ban Chá»§ Nhiá»‡m cÃ³ thá»ƒ chá»‰nh sá»­a ná»™i quy. Ná»™i quy luÃ´n Ä‘á»“ng bá»™ realtime tá»« Cloud Firestore.
            </p>
          )}
        </div>
      )}

      {/* PENALTIES SUB-TAB */}
      {subTab === 'penalties' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="card p-3 border-l-4 border-amber-500">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Tiá»n pháº¡t chá» ná»™p</span>
              <p className="text-lg font-black text-amber-600 mt-1">{totalPending.toLocaleString('vi-VN')} Ä‘</p>
            </div>
            <div className="card p-3 border-l-4 border-emerald-500">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">ÄÃ£ thu vÃ o quá»¹</span>
              <p className="text-lg font-black text-emerald-600 mt-1">{totalCollected.toLocaleString('vi-VN')} Ä‘</p>
            </div>
            <div className="card p-3 border-l-4 border-indigo-500 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Tá»•ng sá»‘ lÆ°á»£t ghi nháº­n</span>
              <p className="text-lg font-black text-indigo-600 mt-1">{(penalties || []).length} lÆ°á»£t</p>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterType === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Táº¥t cáº£ ({(penalties || []).length})
              </button>
              <button
                onClick={() => setFilterType('pending')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterType === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Chá» ná»™p ({(penalties || []).filter(p => p.status === 'Chá» ná»™p').length})
              </button>
              <button
                onClick={() => setFilterType('done')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterType === 'done' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                ÄÃ£ ná»™p / Trao ({(penalties || []).filter(p => p.status !== 'Chá» ná»™p').length})
              </button>
            </div>

            <select
              value={filterBan}
              onChange={e => setFilterBan(e.target.value)}
              className="form-input text-xs py-1 px-2.5 max-w-[140px]"
            >
              <option value="">Táº¥t cáº£ ban</option>
              {['Ná»™i vá»¥', 'Truyá»n thÃ´ng', 'Sá»± kiá»‡n', 'Äá»‘i ngoáº¡i'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Records Table / Cards */}
          <div className="space-y-2.5">
            {filtered.length === 0 && (
              <div className="card py-12 text-center text-slate-400">
                <Icon name="check-circle-2" size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-sm">KhÃ´ng cÃ³ dá»¯ liá»‡u thÆ°á»Ÿng pháº¡t phÃ¹ há»£p</p>
              </div>
            )}
            {filtered.map(item => {
              const isPenalty = (item.amount || 0) < 0 || item.type === 'phat';
              const isPending = item.status === 'Chá» ná»™p';
              return (
                <div key={item.id} className="card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-sm transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.name}</span>
                      {item.ban && <span className="status-badge tag-gray text-[10px]">{item.ban}</span>}
                      <span className={`status-badge text-[10px] ${isPending ? 'tag-yellow' : 'tag-green'}`}>
                        {item.status || 'Chá» ná»™p'}
                      </span>
                      <span className="text-[11px] text-slate-400">{item.date}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.reason}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <p className={`font-mono font-bold text-sm ${isPenalty ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isPenalty ? `-${Math.abs(item.amount || 0).toLocaleString('vi-VN')} Ä‘` : `+${Math.abs(item.amount || 0).toLocaleString('vi-VN')} Ä‘`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPenalty && isPending && (
                        <button
                          onClick={() => setQrPenalty(item)}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold text-xs flex items-center gap-1 border border-orange-200 transition"
                          title="Má»Ÿ mÃ£ QR ná»™p pháº¡t"
                        >
                          <Icon name="qr-code" size={13} /> Ná»™p pháº¡t
                        </button>
                      )}

                      {adminMode && (
                        <button
                          onClick={() => toggleStatus(item)}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition border ${
                            item.status === 'ÄÃ£ ná»™p'
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-300'
                          }`}
                          title="Chuyá»ƒn tráº¡ng thÃ¡i ná»™p"
                        >
                          {item.status === 'ÄÃ£ ná»™p' ? 'ChÆ°a ná»™p' : 'ÄÃ£ ná»™p âœ“'}
                        </button>
                      )}

                      {adminMode && (
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Chá»‰nh sá»­a báº£n ghi"
                        >
                          <Icon name="pencil" size={14} />
                        </button>
                      )}

                      {adminMode && (
                        <button
                          onClick={() => setConfirmDel(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="XÃ³a báº£n ghi"
                        >
                          <Icon name="trash-2" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add / Edit Modal */}
          <Modal open={modal} onClose={() => { setModal(false); setEditingId(null); }} title={editingId ? "Chá»‰nh Sá»­a Báº£n Ghi ThÆ°á»Ÿng / Pháº¡t" : "Ghi Nháº­n ThÆ°á»Ÿng / Pháº¡t Má»›i"}>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="form-label">Loáº¡i ghi nháº­n</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: 'phat', status: 'Chá» ná»™p' }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${form.type === 'phat' ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    âš ï¸ Vi pháº¡m ná»™i quy (Pháº¡t)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: 'thuong', status: 'ÄÃ£ trao' }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${form.type === 'thuong' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    ðŸ† TuyÃªn dÆ°Æ¡ng (ThÆ°á»Ÿng)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">ThÃ nh viÃªn <span className="text-red-500">*</span></label>
                  <select
                    value={form.name}
                    onChange={e => {
                      const val = e.target.value;
                      const m = members.find(mem => mem.name === val);
                      setForm(p => ({ ...p, name: val, ban: m && m.ban ? m.ban : p.ban }));
                    }}
                    className="form-input"
                  >
                    <option value="">-- Chá»n thÃ nh viÃªn --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.name}>{m.name} ({m.ban || 'ThÃ nh viÃªn'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Ban</label>
                  <select value={form.ban} onChange={e => setForm(p => ({ ...p, ban: e.target.value }))} className="form-input">
                    {['Ná»™i vá»¥', 'Truyá»n thÃ´ng', 'Sá»± kiá»‡n', 'Äá»‘i ngoáº¡i', 'ToÃ n CLB'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Sá»‘ tiá»n (VNÄ) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="5000"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))}
                    className="form-input"
                    placeholder="20000"
                  />
                </div>
                <div>
                  <label className="form-label">Tráº¡ng thÃ¡i</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="form-input">
                    <option value="Chá» ná»™p">Chá» ná»™p</option>
                    <option value="ÄÃ£ ná»™p">ÄÃ£ ná»™p</option>
                    <option value="ÄÃ£ trao">ÄÃ£ trao</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">LÃ½ do vi pháº¡m / Khen thÆ°á»Ÿng <span className="text-red-500">*</span></label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  className="form-input resize-none min-h-[70px]"
                  placeholder="VD: Äi muá»™n há»p Ä‘á»‹nh ká»³ 15 phÃºt, HoÃ n thÃ nh xuáº¥t sáº¯c nhiá»‡m vá»¥..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setModal(false); setEditingId(null); }} className="btn-secondary flex-1">Há»§y</button>
                <button type="submit" className="btn-primary flex-1 font-bold">{editingId ? "LÆ°u thay Ä‘á»•i" : "LÆ°u ghi nháº­n"}</button>
              </div>
            </form>
          </Modal>

          {/* Modal CÃ i Ä‘áº·t tÃ i khoáº£n nháº­n ná»™p pháº¡t */}
          <Modal open={bankModal} onClose={() => setBankModal(false)} title="âš™ï¸ CÃ i Äáº·t TÃ i Khoáº£n Nháº­n Ná»™p Pháº¡t">
            <form onSubmit={handleSaveBank} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Cáº¥u hÃ¬nh thÃ´ng tin tÃ i khoáº£n ngÃ¢n hÃ ng cá»§a Ban Chá»§ Nhiá»‡m / Thá»§ quá»¹ Ä‘á»ƒ tá»± Ä‘á»™ng sinh mÃ£ VietQR khi thÃ nh viÃªn báº¥m "Ná»™p pháº¡t".
              </p>

              <div>
                <label className="form-label">NgÃ¢n hÃ ng thá»¥ hÆ°á»Ÿng <span className="text-red-500">*</span></label>
                <select
                  value={bankForm.bank}
                  onChange={e => {
                    const code = e.target.value;
                    const found = POPULAR_BANKS.find(b => b.code === code);
                    setBankForm(p => ({ ...p, bank: code, bankName: found ? found.name : code }));
                  }}
                  className="form-input"
                >
                  {POPULAR_BANKS.map(b => (
                    <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Sá»‘ tÃ i khoáº£n <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={bankForm.accountNo}
                    onChange={e => setBankForm(p => ({ ...p, accountNo: e.target.value }))}
                    className="form-input font-mono font-bold"
                    placeholder="VÃ­ dá»¥: 123456789..."
                    required
                  />
                </div>
                <div>
                  <label className="form-label">TÃªn chá»§ tÃ i khoáº£n</label>
                  <input
                    type="text"
                    value={bankForm.accountName}
                    onChange={e => setBankForm(p => ({ ...p, accountName: e.target.value.toUpperCase() }))}
                    className="form-input uppercase"
                    placeholder="VÃ­ dá»¥: NGUYEN VAN A"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  Link áº£nh QR tá»± táº£i lÃªn <span className="text-slate-400 font-normal">(TÃ¹y chá»n)</span>
                </label>
                <input
                  type="url"
                  value={bankForm.customQrUrl}
                  onChange={e => setBankForm(p => ({ ...p, customQrUrl: e.target.value }))}
                  className="form-input text-xs"
                  placeholder="https://... (náº¿u muá»‘n dÃ¹ng áº£nh QR riÃªng thay vÃ¬ táº¡o tá»± Ä‘á»™ng qua VietQR)"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Máº·c Ä‘á»‹nh há»‡ thá»‘ng tá»± Ä‘á»™ng táº¡o mÃ£ VietQR chuáº©n ngÃ¢n hÃ ng tá»« MÃ£ NH vÃ  Sá»‘ tÃ i khoáº£n á»Ÿ trÃªn.
                </p>
              </div>

              {/* Mini Preview */}
              {bankForm.accountNo && bankForm.bank && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <img
                    src={bankForm.customQrUrl && bankForm.customQrUrl.trim()
                      ? bankForm.customQrUrl.trim()
                      : `https://img.vietqr.io/image/${bankForm.bank}-${bankForm.accountNo}-compact.png?amount=20000&addInfo=XEMTRUOC`}
                    alt="Preview QR"
                    className="w-14 h-14 rounded-lg border bg-white object-contain flex-shrink-0"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div className="text-xs space-y-0.5 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{bankForm.bankName || bankForm.bank}</p>
                    <p className="font-mono text-blue-600 dark:text-blue-400 font-bold">{bankForm.accountNo}</p>
                    {bankForm.accountName && <p className="text-slate-500 uppercase text-[11px] truncate">{bankForm.accountName}</p>}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBankModal(false)}
                  className="btn-secondary flex-1"
                  disabled={bankSaving}
                >
                  Há»§y
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 font-bold"
                  disabled={bankSaving}
                >
                  {bankSaving ? 'Äang lÆ°u...' : 'ðŸ’¾ LÆ°u cáº¥u hÃ¬nh'}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}

      <VietQRModal isOpen={!!qrPenalty} onClose={() => setQrPenalty(null)} penalty={qrPenalty} />
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} message="XÃ³a báº£n ghi thÆ°á»Ÿng/pháº¡t nÃ y?" />
    </div>
  );
}
// ============================================================
function ResourcesPage(){
  const{resources,setResources,inventory,setInventory,expenses,setExpenses,addNotification,studyResources,events}=useContext(AppCtx);
  const[dupWarning,setDupWarning]=useState(null);
  const[tab,setTab]=useState('links');
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[confirmDel,setConfirmDel]=useState(null);
  const[filterBan,setFilterBan]=useState('');
  const[filterType,setFilterType]=useState('');
  const emptyLink={title:'',url:'',ban:'',type:LINK_TYPES[0],note:''};
  const emptyInv={name:'',quantity:1,status:'Tá»‘t',keeper:'',location:'',note:''};
  const emptyExp={name:'',amount:'',person:'',ban:'',status:'Dá»± trÃ¹',note:''};
  const[linkForm,setLinkForm]=useState(emptyLink);
  const[invForm,setInvForm]=useState(emptyInv);
  const[expForm,setExpForm]=useState(emptyExp);

  const openAdd=()=>{
    setEditing(null);
    if(tab==='links')setLinkForm(emptyLink);
    if(tab==='inventory')setInvForm(emptyInv);
    if(tab==='expenses')setExpForm(emptyExp);
    setModal(true);
  };
  const openEdit=item=>{
    setEditing(item.id);
    if(tab==='links')setLinkForm({...item});
    if(tab==='inventory')setInvForm({...item});
    if(tab==='expenses')setExpForm({...item});
    setModal(true);
  };
  const handleClose=()=>{setModal(false);setEditing(null)};

  const handleSave=async(forceSave=false)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      if(tab==='links'){
        if(!linkForm.title.trim()||!linkForm.url.trim()){alert('Vui lÃ²ng nháº­p tÃªn vÃ  URL!');return}
        if(!forceSave){
          const dup = await checkDuplicateLinkAsync(linkForm.url, editing, { studyResources, resources, events });
          if(dup){
            setDupWarning({
              creator: dup.creator,
              onConfirm: ()=>{
                setDupWarning(null);
                handleSave(true);
              }
            });
            return;
          }
        }
        if(editing){
          await fbDb.collection('resources').doc(editing).set(linkForm,{merge:true});
          try{playSound('success');}catch(e){}
          try{addNotification(`ÄÃ£ cáº­p nháº­t link: ${linkForm.title}`,'success');}catch(e){}
        }else{
          const id=uid();
          await fbDb.collection('resources').doc(id).set({...linkForm,id,createdAt:new Date().toISOString()});
          try{playSound('success');}catch(e){}
          try{addNotification(`ÄÃ£ thÃªm link má»›i: ${linkForm.title}`,'success');}catch(e){}
        }
      }else if(tab==='inventory'){
        if(!invForm.name.trim()){alert('Vui lÃ²ng nháº­p tÃªn Ä‘á»“ váº­t!');return}
        if(editing){
          await fbDb.collection('inventory').doc(editing).set(invForm,{merge:true});
          try{playSound('success');}catch(e){}
          try{addNotification(`ÄÃ£ cáº­p nháº­t váº­t dá»¥ng: ${invForm.name}`,'success');}catch(e){}
        }else{
          const id=uid();
          await fbDb.collection('inventory').doc(id).set({...invForm,id,createdAt:new Date().toISOString()});
          try{playSound('success');}catch(e){}
          try{addNotification(`ÄÃ£ thÃªm váº­t dá»¥ng má»›i: ${invForm.name}`,'success');}catch(e){}
        }
      }else if(tab==='expenses'){
        if(!expForm.name.trim()){alert('Vui lÃ²ng nháº­p tÃªn khoáº£n chi!');return}
        if(editing){
          await fbDb.collection('expenses').doc(editing).set(expForm,{merge:true});
          try{playSound('success');}catch(e){}
          try{addNotification(`ÄÃ£ cáº­p nháº­t khoáº£n chi: ${expForm.name}`,'success');}catch(e){}
        }else{
          const id=uid();
          await fbDb.collection('expenses').doc(id).set({...expForm,id,createdAt:new Date().toISOString()});
          try{playSound('success');}catch(e){}
          try{addNotification(`ÄÃ£ thÃªm khoáº£n chi má»›i: ${expForm.name}`,'success');}catch(e){}
          if(expForm.status==='ÄÃ£ chi - Chá» hoÃ n tiá»n'){
            try{addNotification(`ðŸ’° Khoáº£n chi chá» hoÃ n tiá»n: ${expForm.name} â€“ ${fmtVND(expForm.amount)}`,'warning');}catch(e){}
          }
        }
      }
      handleClose();
    }catch(err){
      console.error('Lá»—i lÆ°u tÃ i nguyÃªn/quá»¹/tÃ i sáº£n:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleDeleteItem=async()=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const colName=tab==='links'?'resources':tab==='inventory'?'inventory':'expenses';
      await fbDb.collection(colName).doc(confirmDel).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ xÃ³a má»¥c thÃ nh cÃ´ng','info');}catch(e){}
    }catch(err){
      console.error('Lá»—i xÃ³a má»¥c:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  let filteredResources=resources;
  if(filterBan)filteredResources=filteredResources.filter(r=>r.ban===filterBan);
  if(filterType)filteredResources=filteredResources.filter(r=>r.type===filterType);

  const totalExp=expenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const pendingReim=expenses.filter(e=>e.status==='ÄÃ£ chi - Chá» hoÃ n tiá»n').reduce((s,e)=>s+(Number(e.amount)||0),0);
  const modalTitle=tab==='links'?(editing?'Chá»‰nh sá»­a link':'ThÃªm link tÃ i liá»‡u'):tab==='inventory'?(editing?'Chá»‰nh sá»­a váº­t dá»¥ng':'ThÃªm váº­t dá»¥ng'):(editing?'Chá»‰nh sá»­a khoáº£n chi':'ThÃªm khoáº£n chi má»›i');

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Kho TÃ i NguyÃªn & Quá»¹ Ná»™i Vá»¥</h1><p className="text-xs text-slate-500 mt-0.5">Link tÃ i liá»‡u, váº­t dá»¥ng CLB vÃ  chi tiÃªu sá»± kiá»‡n</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="plus" size={15}/>ThÃªm má»›i</button>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['links','ðŸ”— Kho Link'],['inventory','ðŸ“¦ Váº­t Dá»¥ng'],['expenses','ðŸ’° Chi TiÃªu']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab===v?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab==='links'&&(
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select value={filterBan} onChange={e=>setFilterBan(e.target.value)} className="form-input text-sm w-auto">
              <option value="">Táº¥t cáº£ ban</option>
              {BANS.map(b=><option key={b}>{b}</option>)}
            </select>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="form-input text-sm w-auto">
              <option value="">Táº¥t cáº£ loáº¡i</option>
              {LINK_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            {(filterBan||filterType)&&<button onClick={()=>{setFilterBan('');setFilterType('')}} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"><Icon name="x-circle" size={13}/>XÃ³a lá»c</button>}
          </div>
          {filteredResources.length===0&&<div className="card py-14 text-center"><Icon name="folder-open" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">ChÆ°a cÃ³ link tÃ i liá»‡u nÃ o</p><p className="text-sm text-slate-300 mt-1">LÆ°u trá»¯ link Google Drive, Canva, Forms, Docs...</p></div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredResources.map(r=>{
              const cfg=LINK_TYPE_CFG[r.type]||LINK_TYPE_CFG['BiÃªn báº£n & HÃ nh chÃ­nh'];
              return(
                <div key={r.id} className={`card p-4 fade-in border-l-4 ${cfg.border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${cfg.bg} rounded-xl flex items-center justify-center flex-shrink-0`}><Icon name={cfg.icon} size={18} className={cfg.text}/></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{r.title}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">{r.url}</a>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className={`status-badge text-[11px] ${cfg.bg} ${cfg.text}`} style={{border:'none'}}>{r.type}</span>
                        {r.ban&&<span className="status-badge tag-gray text-[11px]">{r.ban}</span>}
                      </div>
                      {r.note&&<p className="text-xs text-slate-400 mt-1 truncate">{r.note}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 pt-2.5 border-t border-slate-100 justify-end">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"><Icon name="external-link" size={14}/></a>
                    <button onClick={()=>openEdit(r)} className="p-1.5 rounded-lg hover:bg-slate-100"><Icon name="pencil" size={14} className="text-slate-400"/></button>
                    <button onClick={()=>setConfirmDel(r.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Icon name="trash-2" size={14} className="text-red-400"/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==='inventory'&&(
        <div className="space-y-3">
          {inventory.length===0&&<div className="card py-14 text-center"><Icon name="box" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">ChÆ°a cÃ³ váº­t dá»¥ng nÃ o</p><p className="text-sm text-slate-300 mt-1">Quáº£n lÃ½ loa, mic, standee, dÃ¢y nguá»“n...</p></div>}
          {inventory.map(item=>(
            <div key={item.id} className="card p-4 fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0"><Icon name="box" size={18} className="text-teal-600"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                      <span className={`status-badge text-xs ${item.status==='Tá»‘t'?'tag-green':item.status==='Há»ng/Máº¥t phá»¥ kiá»‡n'?'tag-red':'tag-yellow'}`}>{item.status}</span>
                      {item.quantity&&<span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">SL: {item.quantity}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
                      {item.keeper&&<span className="flex items-center gap-1"><Icon name="user" size={11}/>NgÆ°á»i giá»¯: {item.keeper}</span>}
                      {item.location&&<span className="flex items-center gap-1"><Icon name="map-pin" size={11}/>{item.location}</span>}
                    </div>
                    {item.note&&<p className="text-xs text-slate-400 mt-1 italic">{item.note}</p>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>openEdit(item)} className="p-2 rounded-lg hover:bg-slate-100"><Icon name="pencil" size={14} className="text-slate-400"/></button>
                  <button onClick={()=>setConfirmDel(item.id)} className="p-2 rounded-lg hover:bg-red-50"><Icon name="trash-2" size={14} className="text-red-400"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='expenses'&&(
        <div className="space-y-3">
          {expenses.length>0&&(
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-3 text-white" style={{background:'linear-gradient(135deg,#4f46e5,#2563eb)'}}>
                <p className="text-xs opacity-80 mb-1">Tá»•ng chi tiÃªu</p>
                <p className="text-xl font-black">{fmtVND(totalExp)}</p>
              </div>
              <div className="rounded-2xl p-3 text-white" style={{background:'linear-gradient(135deg,#f59e0b,#ea580c)'}}>
                <p className="text-xs opacity-80 mb-1">Chá» hoÃ n tiá»n</p>
                <p className="text-xl font-black">{fmtVND(pendingReim)}</p>
              </div>
            </div>
          )}
          {expenses.length===0&&<div className="card py-14 text-center"><Icon name="wallet" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">ChÆ°a cÃ³ khoáº£n chi nÃ o</p><p className="text-sm text-slate-300 mt-1">Ghi láº¡i dá»± trÃ¹ vÃ  chi tiÃªu cá»§a Ban Ná»™i Vá»¥</p></div>}
          <div className="space-y-2">
            {expenses.map(exp=>(
              <div key={exp.id} className="card p-3.5 fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`status-badge text-xs ${expenseColor(exp.status)}`}>{exp.status}</span>
                      {exp.ban&&<span className="status-badge tag-gray text-xs">{exp.ban}</span>}
                    </div>
                    <p className="font-bold text-slate-800 text-sm">{exp.name}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      {exp.amount&&<span className="text-base font-black text-slate-800">{fmtVND(exp.amount)}</span>}
                      {exp.person&&<span className="flex items-center gap-1 mt-0.5"><Icon name="user" size={11}/>á»¨ng tiá»n: <b className="text-slate-700">{exp.person}</b></span>}
                    </div>
                    {exp.note&&<p className="text-xs text-slate-400 mt-1">{exp.note}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={()=>openEdit(exp)} className="p-2 rounded-lg hover:bg-slate-100"><Icon name="pencil" size={14} className="text-slate-400"/></button>
                    <button onClick={()=>setConfirmDel(exp.id)} className="p-2 rounded-lg hover:bg-red-50"><Icon name="trash-2" size={14} className="text-red-400"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={modal} onClose={handleClose} title={modalTitle}>
        {tab==='links'&&(
          <div className="space-y-4">
            <div><label className="form-label">TÃªn tÃ i liá»‡u <span className="text-red-500">*</span></label><input value={linkForm.title} onChange={e=>setLinkForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="VD: Káº¿ hoáº¡ch Talkshow thÃ¡ng 11..."/></div>
            <div><label className="form-label">ÄÆ°á»ng dáº«n (URL) <span className="text-red-500">*</span></label><input value={linkForm.url} onChange={e=>setLinkForm(p=>({...p,url:e.target.value}))} className="form-input" placeholder="https://docs.google.com/..."/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Loáº¡i tÃ i liá»‡u</label><select value={linkForm.type} onChange={e=>setLinkForm(p=>({...p,type:e.target.value}))} className="form-input">{LINK_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="form-label">Ban phá»¥ trÃ¡ch</label><select value={linkForm.ban} onChange={e=>setLinkForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chá»n ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
            </div>
            <div><label className="form-label">Ghi chÃº</label><input value={linkForm.note} onChange={e=>setLinkForm(p=>({...p,note:e.target.value}))} className="form-input" placeholder="MÃ´ táº£ ngáº¯n vá» tÃ i liá»‡u..."/></div>
            <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'LÆ°u':'ThÃªm link'}</button></div>
          </div>
        )}
        {tab==='inventory'&&(
          <div className="space-y-4">
            <div><label className="form-label">TÃªn Ä‘á»“ váº­t <span className="text-red-500">*</span></label><input value={invForm.name} onChange={e=>setInvForm(p=>({...p,name:e.target.value}))} className="form-input" placeholder="VD: Loa di Ä‘á»™ng JBL..."/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Sá»‘ lÆ°á»£ng</label><input type="number" min="1" value={invForm.quantity} onChange={e=>setInvForm(p=>({...p,quantity:e.target.value}))} className="form-input"/></div>
              <div><label className="form-label">TÃ¬nh tráº¡ng</label><select value={invForm.status} onChange={e=>setInvForm(p=>({...p,status:e.target.value}))} className="form-input">{INVENTORY_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">NgÆ°á»i Ä‘ang giá»¯</label><input value={invForm.keeper} onChange={e=>setInvForm(p=>({...p,keeper:e.target.value}))} className="form-input" placeholder="TÃªn ngÆ°á»i giá»¯"/></div>
              <div><label className="form-label">Vá»‹ trÃ­ lÆ°u trá»¯</label><input value={invForm.location} onChange={e=>setInvForm(p=>({...p,location:e.target.value}))} className="form-input" placeholder="Tá»§ phÃ²ng BCN, nhÃ ..."/></div>
            </div>
            <div><label className="form-label">Ghi chÃº</label><textarea value={invForm.note} onChange={e=>setInvForm(p=>({...p,note:e.target.value}))} className="form-input resize-none min-h-[60px]" placeholder="ThÃªm ghi chÃº..."/></div>
            <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'LÆ°u':'ThÃªm váº­t dá»¥ng'}</button></div>
          </div>
        )}
        {tab==='expenses'&&(
          <div className="space-y-4">
            <div><label className="form-label">TÃªn khoáº£n chi <span className="text-red-500">*</span></label><input value={expForm.name} onChange={e=>setExpForm(p=>({...p,name:e.target.value}))} className="form-input" placeholder="VD: In áº¥n backdrop sá»± kiá»‡n..."/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Sá»‘ tiá»n (VNÄ)</label><input type="number" value={expForm.amount} onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))} className="form-input" placeholder="500000"/></div>
              <div><label className="form-label">NgÆ°á»i á»©ng tiá»n</label><input value={expForm.person} onChange={e=>setExpForm(p=>({...p,person:e.target.value}))} className="form-input" placeholder="TÃªn ngÆ°á»i á»©ng tiá»n"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Ban phá»¥ trÃ¡ch</label><select value={expForm.ban} onChange={e=>setExpForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chá»n ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
              <div><label className="form-label">Tráº¡ng thÃ¡i</label><select value={expForm.status} onChange={e=>setExpForm(p=>({...p,status:e.target.value}))} className="form-input">{EXPENSE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="form-label">Ghi chÃº</label><textarea value={expForm.note} onChange={e=>setExpForm(p=>({...p,note:e.target.value}))} className="form-input resize-none min-h-[60px]" placeholder="MÃ´ táº£ chi tiáº¿t, link hÃ³a Ä‘Æ¡n..."/></div>
            <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Há»§y</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'LÆ°u':'ThÃªm khoáº£n chi'}</button></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={handleDeleteItem} message="Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a má»¥c nÃ y?"/>
      <DuplicateLinkDialog open={!!dupWarning} creator={dupWarning?.creator} onCancel={()=>setDupWarning(null)} onConfirm={dupWarning?.onConfirm}/>
    </div>
  );
}

// ============================================================
// GÃ“C Há»ŒC Táº¬P NVC (STUDY HUB MODULE)
// ============================================================
const STUDY_BLOCKS = [
  'Táº¥t cáº£',
  'Äáº¡i cÆ°Æ¡ng',
  'CÆ¡ sá»Ÿ ngÃ nh',
  'ChuyÃªn ngÃ nh DÆ°á»£c'
];

const STUDY_CATEGORIES = [
  'Táº¥t cáº£',
  'Äá» thi & ÄÃ¡p Ã¡n',
  'Slide bÃ i giáº£ng',
  'GiÃ¡o trÃ¬nh/SÃ¡ch',
  'TÃ³m táº¯t lÃ½ thuyáº¿t'
];

function StudyHubPage(){
  const{studyResources,setStudyResources,addNotification,playSound,adminMode,userIdentity,resources,events}=useContext(AppCtx);
  const[dupWarning,setDupWarning]=useState(null);
  const[selectedBlock,setSelectedBlock]=useState('Táº¥t cáº£');
  const[selectedCat,setSelectedCat]=useState('Táº¥t cáº£');
  const[searchQuery,setSearchQuery]=useState('');
  const[modalOpen,setModalOpen]=useState(false);
  const[editingId,setEditingId]=useState(null);
  const[confirmDeleteId,setConfirmDeleteId]=useState(null);
  const[copiedId,setCopiedId]=useState(null);

  const emptyForm={
    title:'',
    block:'CÆ¡ sá»Ÿ ngÃ nh',
    category:'Äá» thi & ÄÃ¡p Ã¡n',
    url:'',
    contributor:'',
    note:'',
    pinned:false
  };
  const[formData,setFormData]=useState(emptyForm);

  const openAdd=()=>{
    setEditingId(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEdit=(item)=>{
    setEditingId(item.id);
    setFormData({
      title:item.title||'',
      block:item.block||'CÆ¡ sá»Ÿ ngÃ nh',
      category:item.category||'Äá» thi & ÄÃ¡p Ã¡n',
      url:item.url||'',
      contributor:item.contributor||'',
      note:item.note||'',
      pinned:!!item.pinned
    });
    setModalOpen(true);
  };

  const handleSave=async(e,forceSave=false)=>{
    if(e&&e.preventDefault)e.preventDefault();
    if(!formData.title.trim()){
      alert('Vui lÃ²ng nháº­p tÃªn tÃ i liá»‡u / mÃ´n há»c!');
      return;
    }
    if(!formData.url.trim()){
      alert('Vui lÃ²ng nháº­p link tÃ i liá»‡u (Drive/Docs/Sheets)!');
      return;
    }

    if(!forceSave){
      const dup = await checkDuplicateLinkAsync(formData.url, editingId, { studyResources, resources, events });
      if(dup){
        setDupWarning({
          creator: dup.creator,
          onConfirm: ()=>{
            setDupWarning(null);
            handleSave(null, true);
          }
        });
        return;
      }
    }

    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      if(editingId){
        await fbDb.collection('study_resources').doc(editingId).set({
          ...formData,
          updatedAt:new Date().toISOString()
        },{merge:true});
        try{playSound('success');}catch(e){}
        try{addNotification(`ÄÃ£ cáº­p nháº­t tÃ i liá»‡u: ${formData.title}`,'success');}catch(e){}
      }else{
        const id=uid();
        await fbDb.collection('study_resources').doc(id).set({
          ...formData,
          id,
          createdAt:new Date().toISOString()
        });
        try{playSound('success');}catch(e){}
        try{addNotification(`ÄÃ£ Ä‘Ã³ng gÃ³p tÃ i liá»‡u má»›i: ${formData.title}`,'success');}catch(e){}
      }
      setModalOpen(false);
      setEditingId(null);
    }catch(err){
      console.error('Lá»—i lÆ°u tÃ i liá»‡u há»c táº­p:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleDelete=async()=>{
    if(!confirmDeleteId)return;
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      await fbDb.collection('study_resources').doc(confirmDeleteId).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ xÃ³a tÃ i liá»‡u khá»i GÃ³c Há»c Táº­p','info');}catch(e){}
      setConfirmDeleteId(null);
    }catch(err){
      console.error('Lá»—i xÃ³a tÃ i liá»‡u:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleTogglePin=async(item)=>{
    try{
      if(!fbDb)throw new Error('Firebase chÆ°a káº¿t ná»‘i!');
      const newPinned=!item.pinned;
      await fbDb.collection('study_resources').doc(item.id).set({
        pinned:newPinned
      },{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification(newPinned?`ÄÃ£ ghim tÃ i liá»‡u trá»ng tÃ¢m: ${item.title}`:`ÄÃ£ bá» ghim: ${item.title}`,'info');}catch(e){}
    }catch(err){
      console.error('Lá»—i ghim tÃ i liá»‡u:',err);
      alert('Lá»—i lÆ°u Firebase: '+err.message);
    }
  };

  const handleCopyLink=(item)=>{
    if(!item.url)return;
    try{
      if(navigator&&navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(item.url);
      }else{
        const ta=document.createElement('textarea');
        ta.value=item.url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(item.id);
      try{playSound('pop');}catch(e){}
      try{addNotification('ÄÃ£ sao chÃ©p link tÃ i liá»‡u vÃ o bá»™ nhá»› táº¡m!','info');}catch(e){}
      setTimeout(()=>setCopiedId(null),2000);
    }catch(err){
      console.warn('Lá»—i copy clipboard:',err);
    }
  };

  // Filtered resources
  const filteredList=useMemo(()=>{
    return(studyResources||[]).filter(item=>{
      const matchBlock=selectedBlock==='Táº¥t cáº£'||item.block===selectedBlock;
      const matchCat=selectedCat==='Táº¥t cáº£'||item.category===selectedCat;
      const q=searchQuery.toLowerCase().trim();
      const matchSearch=!q||
        (item.title&&item.title.toLowerCase().includes(q))||
        (item.contributor&&item.contributor.toLowerCase().includes(q))||
        (item.note&&item.note.toLowerCase().includes(q))||
        (item.block&&item.block.toLowerCase().includes(q))||
        (item.category&&item.category.toLowerCase().includes(q));
      return matchBlock&&matchCat&&matchSearch;
    });
  },[studyResources,selectedBlock,selectedCat,searchQuery]);

  const pinnedList=useMemo(()=>filteredList.filter(item=>!!item.pinned),[filteredList]);
  const regularList=useMemo(()=>filteredList.filter(item=>!item.pinned),[filteredList]);

  const getCatBadge=(cat)=>{
    switch(cat){
      case 'Äá» thi & ÄÃ¡p Ã¡n':return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      case 'Slide bÃ i giáº£ng':return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
      case 'GiÃ¡o trÃ¬nh/SÃ¡ch':return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'TÃ³m táº¯t lÃ½ thuyáº¿t':return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      default:return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getBlockBadge=(block)=>{
    switch(block){
      case 'Äáº¡i cÆ°Æ¡ng':return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300';
      case 'CÆ¡ sá»Ÿ ngÃ nh':return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
      case 'ChuyÃªn ngÃ nh DÆ°á»£c':return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300';
      default:return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300';
    }
  };

  const renderCard=(item)=>(
    <div
      key={item.id}
      className={`card p-4 sm:p-5 flex flex-col justify-between transition-all hover:shadow-md relative group ${
        item.pinned
          ? 'border-orange-300/80 bg-gradient-to-br from-orange-50/40 via-white to-amber-50/30 dark:from-orange-950/20 dark:via-slate-800 dark:to-amber-950/10 dark:border-orange-700/60 shadow-sm'
          : 'hover:border-slate-300'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.pinned&&(
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-xs">
                <Icon name="flame" size={12}/> Hot Ã´n thi
              </span>
            )}
            <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getCatBadge(item.category)}`}>
              {item.category}
            </span>
            <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border ${getBlockBadge(item.block)}`}>
              {item.block}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {adminMode && (
              <button
                onClick={()=>handleTogglePin(item)}
                title={item.pinned?'Bá» ghim tÃ i liá»‡u':'Ghim tÃ i liá»‡u hot Ã´n thi'}
                className={`p-1.5 rounded-lg transition ${
                  item.pinned
                    ? 'text-orange-600 bg-orange-100 dark:bg-orange-950/50 hover:bg-orange-200'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon name="pin" size={15}/>
              </button>
            )}
            {(adminMode || (userIdentity && item.contributor && item.contributor.toLowerCase().includes(userIdentity.toLowerCase())) || (!item.contributor)) && (
              <button
                onClick={()=>openEdit(item)}
                title="Chá»‰nh sá»­a tÃ i liá»‡u"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Icon name="pencil" size={15}/>
              </button>
            )}
            {adminMode && (
              <button
                onClick={()=>setConfirmDeleteId(item.id)}
                title="XÃ³a tÃ i liá»‡u"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                <Icon name="trash-2" size={15}/>
              </button>
            )}
          </div>
        </div>

        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug mb-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {item.note&&(
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2 leading-relaxed">
            {item.note}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4 pt-1">
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Icon name="user" size={11} className="text-slate-600 dark:text-slate-300"/>
          </div>
          <span className="truncate font-medium">{item.contributor||'ThÃ nh viÃªn NVC'}</span>
          {item.createdAt&&(
            <>
              <span className="text-slate-300 dark:text-slate-600">â€¢</span>
              <span className="text-[11px] text-slate-400 flex-shrink-0">
                {new Date(item.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/80">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center justify-center gap-1.5 py-2 px-3 text-xs sm:text-sm rounded-xl font-semibold shadow-xs"
        >
          <Icon name="external-link" size={14}/>
          <span>Má»Ÿ Drive</span>
        </a>
        <button
          onClick={()=>handleCopyLink(item)}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs sm:text-sm rounded-xl font-semibold border transition ${
            copiedId===item.id
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
          }`}
        >
          <Icon name={copiedId===item.id?"check":"copy"} size={14}/>
          <span>{copiedId===item.id?"ÄÃ£ chÃ©p":"Sao chÃ©p link"}</span>
        </button>
      </div>
    </div>
  );

  return(
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 text-white rounded-2xl shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold mb-2">
              <Icon name="graduation-cap" size={14}/> GÃ³c Há»c Táº­p & Tri Thá»©c NVC
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Kho Äá» Thi, BÃ i Giáº£ng & TÃ i Liá»‡u DÆ°á»£c</h1>
            <p className="text-xs sm:text-sm text-orange-100 mt-1 max-w-xl leading-relaxed">
              NgÃ¢n hÃ ng tÃ i liá»‡u Ã´n thi mÃ´n há»c, Ä‘á» thi cÃ³ Ä‘Ã¡p Ã¡n, tÃ³m táº¯t lÃ½ thuyáº¿t vÃ  slide bÃ i giáº£ng dÃ nh riÃªng cho cÃ¡c tháº¿ há»‡ thÃ nh viÃªn NewVision HUP.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-white text-orange-600 hover:bg-orange-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition active:scale-95 flex-shrink-0"
          >
            <Icon name="plus" size={17} className="text-orange-600"/>
            <span>ÄÃ³ng gÃ³p tÃ i liá»‡u</span>
          </button>
        </div>
        <div className="absolute -right-6 -bottom-8 opacity-15 pointer-events-none text-white">
          <Icon name="book-open" size={160}/>
        </div>
      </div>

      {/* Filter Section */}
      <div className="card p-4 sm:p-5 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e=>setSearchQuery(e.target.value)}
            placeholder="TÃ¬m theo tÃªn mÃ´n há»c, ngÆ°á»i chia sáº», ghi chÃº tÃ i liá»‡u (VD: DÆ°á»£c lÃ½, HÃ³a DÆ°á»£c, Giáº£i pháº«u...)..."
            className="form-input text-sm pl-9 pr-9"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon name="search" size={16}/>
          </span>
          {searchQuery&&(
            <button onClick={()=>setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
              <Icon name="x" size={14}/>
            </button>
          )}
        </div>

        {/* Khá»‘i / KhÃ³a Filter Chips */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Icon name="layers" size={13}/> Khá»‘i / KhÃ³a:
          </div>
          <div className="chip-bar">
            {STUDY_BLOCKS.map(b=>(
              <button
                key={b}
                onClick={()=>setSelectedBlock(b)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  selectedBlock===b
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* PhÃ¢n loáº¡i tÃ i liá»‡u Filter Chips */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Icon name="filter" size={13}/> PhÃ¢n loáº¡i tÃ i liá»‡u:
          </div>
          <div className="chip-bar">
            {STUDY_CATEGORIES.map(c=>(
              <button
                key={c}
                onClick={()=>setSelectedCat(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  selectedCat===c
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pinned Section: TÃ i Liá»‡u Ã”n Thi Trá»ng TÃ¢m */}
      {pinnedList.length>0&&(
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs">
                <Icon name="flame" size={16}/>
              </span>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                TÃ i Liá»‡u Ã”n Thi Trá»ng TÃ¢m (Hot)
              </h2>
              <span className="text-xs bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold px-2 py-0.5 rounded-full">
                {pinnedList.length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedList.map(renderCard)}
          </div>
        </section>
      )}

      {/* Regular Section: Táº¥t cáº£ tÃ i liá»‡u */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-xs">
              <Icon name="folder-open" size={15}/>
            </span>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Táº¥t cáº£ tÃ i liá»‡u mÃ´n há»c ({regularList.length})
            </h2>
          </div>
        </div>

        {regularList.length===0?(
          <div className="card p-10 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
              <Icon name="book-open" size={28}/>
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-base mb-1">
              {searchQuery||selectedBlock!=='Táº¥t cáº£'||selectedCat!=='Táº¥t cáº£'?'KhÃ´ng cÃ³ tÃ i liá»‡u nÃ o phÃ¹ há»£p bá»™ lá»c':'ChÆ°a cÃ³ tÃ i liá»‡u nÃ o'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              HÃ£y trá»Ÿ thÃ nh ngÆ°á»i Ä‘áº§u tiÃªn Ä‘Ã³ng gÃ³p Ä‘á» thi, slide hoáº·c tÃ i liá»‡u há»c táº­p bá»• Ã­ch cho cÃ¡c tháº¿ há»‡ thÃ nh viÃªn NVC!
            </p>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-xs sm:text-sm py-2 px-4 rounded-xl">
              <Icon name="plus" size={16}/> ÄÃ³ng gÃ³p tÃ i liá»‡u má»›i
            </button>
          </div>
        ):(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularList.map(renderCard)}
          </div>
        )}
      </section>

      {/* Modal Form: ThÃªm má»›i / Chá»‰nh sá»­a */}
      {modalOpen&&(
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModalOpen(false);}}>
          <div className="modal-box p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 flex items-center justify-center">
                  <Icon name="book-open" size={18}/>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                    {editingId?'Chá»‰nh sá»­a tÃ i liá»‡u há»c táº­p':'ÄÃ³ng gÃ³p tÃ i liá»‡u há»c táº­p má»›i'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Chia sáº» tri thá»©c DÆ°á»£c HÃ  Ná»™i cho cá»™ng Ä‘á»“ng NewVision HUP</p>
                </div>
              </div>
              <button onClick={()=>setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                <Icon name="x" size={18}/>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="form-label">TÃªn tÃ i liá»‡u / MÃ´n há»c <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="VD: Tá»•ng há»£p Äá» thi DÆ°á»£c lÃ½ 1 K78-K79 cÃ³ giáº£i thÃ­ch chi tiáº¿t"
                  value={formData.title}
                  onChange={e=>setFormData({...formData,title:e.target.value})}
                  className="form-input text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Khá»‘i / KhÃ³a Ä‘Ã o táº¡o <span className="text-red-500">*</span></label>
                  <select
                    value={formData.block}
                    onChange={e=>setFormData({...formData,block:e.target.value})}
                    className="form-input text-sm"
                  >
                    <option value="Äáº¡i cÆ°Æ¡ng">Äáº¡i cÆ°Æ¡ng (NÄƒm 1)</option>
                    <option value="CÆ¡ sá»Ÿ ngÃ nh">CÆ¡ sá»Ÿ ngÃ nh (NÄƒm 2 - 3)</option>
                    <option value="ChuyÃªn ngÃ nh DÆ°á»£c">ChuyÃªn ngÃ nh DÆ°á»£c (NÄƒm 4 - 5)</option>
                    <option value="K79">KhÃ³a K79</option>
                    <option value="K80">KhÃ³a K80</option>
                    <option value="K81">KhÃ³a K81</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">PhÃ¢n loáº¡i tÃ i liá»‡u <span className="text-red-500">*</span></label>
                  <select
                    value={formData.category}
                    onChange={e=>setFormData({...formData,category:e.target.value})}
                    className="form-input text-sm"
                  >
                    <option value="Äá» thi & ÄÃ¡p Ã¡n">Äá» thi & ÄÃ¡p Ã¡n</option>
                    <option value="Slide bÃ i giáº£ng">Slide bÃ i giáº£ng</option>
                    <option value="GiÃ¡o trÃ¬nh/SÃ¡ch">GiÃ¡o trÃ¬nh / SÃ¡ch tham kháº£o</option>
                    <option value="TÃ³m táº¯t lÃ½ thuyáº¿t">TÃ³m táº¯t lÃ½ thuyáº¿t / Mindmap</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Link Drive / Docs / Sheets <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/..."
                    value={formData.url}
                    onChange={e=>setFormData({...formData,url:e.target.value})}
                    className="form-input text-sm pl-9"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icon name="link" size={15}/>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Äáº£m báº£o link Drive Ä‘Ã£ má»Ÿ quyá»n "Báº¥t ká»³ ai cÃ³ Ä‘Æ°á»ng liÃªn káº¿t Ä‘á»u xem Ä‘Æ°á»£c".</p>
              </div>

              <div>
                <label className="form-label">NgÆ°á»i Ä‘Ã³ng gÃ³p (TÃªn / Lá»›p / KhÃ³a)</label>
                <input
                  type="text"
                  placeholder="VD: Nguyá»…n VÄƒn A - Lá»›p A2K78"
                  value={formData.contributor}
                  onChange={e=>setFormData({...formData,contributor:e.target.value})}
                  className="form-input text-sm"
                />
              </div>

              <div>
                <label className="form-label">Ghi chÃº Ã´n thi / HÆ°á»›ng dáº«n sá»­ dá»¥ng</label>
                <textarea
                  rows="2"
                  placeholder="VD: TÃ i liá»‡u gá»“m 5 Ä‘á» thi cÃ¡c nÄƒm gáº§n Ä‘Ã¢y, trá»ng tÃ¢m pháº§n khÃ¡ng sinh..."
                  value={formData.note}
                  onChange={e=>setFormData({...formData,note:e.target.value})}
                  className="form-input text-sm"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="pinnedStudyResource"
                  checked={formData.pinned}
                  onChange={e=>setFormData({...formData,pinned:e.target.checked})}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="pinnedStudyResource" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                  <span className="text-orange-500"><Icon name="flame" size={15}/></span>
                  Ghim ná»•i báº­t vÃ o má»¥c "TÃ i liá»‡u Ã´n thi trá»ng tÃ¢m (Hot)"
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={()=>setModalOpen(false)}
                  className="btn-secondary text-xs sm:text-sm py-2 px-4 rounded-xl"
                >
                  Há»§y bá»
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs sm:text-sm py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 shadow-md"
                >
                  <Icon name="check" size={16}/>
                  <span>{editingId?'LÆ°u thay Ä‘á»•i':'ÄÄƒng tÃ i liá»‡u'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId&&(
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setConfirmDeleteId(null);}}>
          <div className="modal-box p-5 max-w-sm">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto mb-3">
                <Icon name="trash-2" size={24}/>
              </div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">XÃ¡c nháº­n xÃ³a tÃ i liá»‡u?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                TÃ i liá»‡u nÃ y sáº½ bá»‹ xÃ³a vÄ©nh viá»…n khá»i Cloud Firestore cá»§a toÃ n bá»™ cÃ¢u láº¡c bá»™.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={()=>setConfirmDeleteId(null)} className="btn-secondary text-xs sm:text-sm py-2 px-4 rounded-xl flex-1">
                  KhÃ´ng xÃ³a
                </button>
                <button onClick={handleDelete} className="btn-danger text-xs sm:text-sm py-2 px-4 rounded-xl flex-1">
                  XÃ¡c nháº­n xÃ³a
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <DuplicateLinkDialog open={!!dupWarning} creator={dupWarning?.creator} onCancel={()=>setDupWarning(null)} onConfirm={dupWarning?.onConfirm}/>
    </div>
  );
}

// ============================================================
// NOTIFICATIONS PAGE
// ============================================================
function NotificationsPage(){
  const{notifications,markRead,markAllRead,unreadCount}=useContext(AppCtx);
  const[filter,setFilter]=useState('all');
  const typeIcons={info:'info',success:'check-circle',warning:'alert-triangle',error:'x-circle'};
  const typeColors={info:'text-blue-500 bg-blue-50',success:'text-emerald-500 bg-emerald-50',warning:'text-amber-500 bg-amber-50',error:'text-red-500 bg-red-50'};
  const filtered=filter==='unread'?notifications.filter(n=>!n.read):notifications;
  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Lá»‹ch Sá»­ Hoáº¡t Äá»™ng</h1><p className="text-xs text-slate-500 mt-0.5">{unreadCount} thÃ´ng bÃ¡o chÆ°a Ä‘á»c</p></div>
        {unreadCount>0&&<button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"><Icon name="check-check" size={15}/>ÄÃ¡nh dáº¥u táº¥t cáº£</button>}
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['all','Táº¥t cáº£'],['unread','ChÆ°a Ä‘á»c']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter===v?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>{l}{v==='unread'&&unreadCount>0?` (${unreadCount})`:''}</button>
        ))}
      </div>
      {filtered.length===0?(
        <div className="card py-20 text-center">
          <Icon name="bell-off" size={48} className="text-slate-200 mx-auto mb-4"/>
          <p className="text-slate-400 font-medium text-lg">KhÃ´ng cÃ³ thÃ´ng bÃ¡o</p>
          <p className="text-sm text-slate-300 mt-1">{filter==='unread'?'Báº¡n Ä‘Ã£ Ä‘á»c táº¥t cáº£!':'ChÆ°a cÃ³ hoáº¡t Ä‘á»™ng nÃ o'}</p>
        </div>
      ):(
        <div className="card overflow-hidden divide-y divide-slate-50">
          {filtered.map(n=>(
            <div key={n.id} className={`flex gap-3 p-4 hover:bg-slate-50 transition ${!n.read?'bg-blue-50/40':''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[n.type]||typeColors.info}`}><Icon name={typeIcons[n.type]||'info'} size={17}/></div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!n.read?'font-semibold text-slate-800':'text-slate-600'}`}>{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{relTime(n.timestamp)} Â· {new Date(n.timestamp).toLocaleString('vi-VN')}</p>
              </div>
              {!n.read&&<div className="flex items-start gap-2 flex-shrink-0"><div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"/><button onClick={()=>markRead(n.id)} className="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap">ÄÃ¡nh dáº¥u Ä‘Ã£ Ä‘á»c</button></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FLOATING ACTION BUTTON (Mobile)
// ============================================================
function FAB({setActiveTab}){
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);
  },[]);
  const actions=[
    {label:'Táº¡o sá»± kiá»‡n má»›i',icon:'calendar-plus',color:'bg-blue-500 text-white',tab:'events'},
    {label:'Ghi nháº­n váº¥n Ä‘á»',icon:'file-plus',color:'bg-amber-500 text-white',tab:'decisions'},
    {label:'GÃ³c há»c táº­p NVC',icon:'book-open',color:'bg-emerald-500 text-white',tab:'study'},
    {label:'ThÃªm link tÃ i liá»‡u',icon:'link',color:'bg-purple-500 text-white',tab:'resources'},
  ];
  return(
    <div ref={ref} className="fab-container md:hidden fixed bottom-20 left-4 z-[70]">
      {open&&(
        <div className="absolute bottom-14 left-0 space-y-2">
          {actions.map((a,i)=>(
            <button key={a.label} onClick={()=>{setActiveTab(a.tab);setOpen(false)}} className={`fab-item flex items-center gap-2.5 ${a.color} rounded-2xl px-4 py-2.5 shadow-xl text-sm font-semibold whitespace-nowrap`} style={{animationDelay:`${i*0.05}s`}}>
              <Icon name={a.icon} size={16}/>{a.label}
            </button>
          ))}
        </div>
      )}
      <button onClick={()=>setOpen(o=>!o)} className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-2xl active:scale-95" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',transform:`rotate(${open?'45deg':'0'})`,transition:'transform 0.25s cubic-bezier(.34,1.56,.64,1)'}}>
        <Icon name="plus" size={24} className="text-white"/>
      </button>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
const NAV_ITEMS=[
  {id:'dashboard',label:'Tá»•ng quan',icon:'layout-dashboard'},
  {id:'events',label:'Sá»± kiá»‡n',icon:'calendar-days'},
  {id:'study',label:'GÃ³c há»c táº­p',icon:'book-open'},
  {id:'members',label:'ThÃ nh viÃªn',icon:'users'},
  {id:'penalties',label:'ThÆ°á»Ÿng & Pháº¡t',icon:'scale'},
  {id:'decisions',label:'Quyáº¿t Ä‘á»‹nh',icon:'file-check-2'},
  {id:'resources',label:'TÃ i nguyÃªn',icon:'folder-open',isLocked:true},
  {id:'bcn',label:'PhÃ²ng BCN',icon:'shield',isBcn:true,isLocked:true},
];

const MOBILE_NAV_ITEMS=[
  {id:'dashboard',label:'Tá»•ng quan',icon:'layout-dashboard'},
  {id:'events',label:'Sá»± kiá»‡n',icon:'calendar-days'},
  {id:'study',label:'Há»c táº­p',icon:'book-open'},
  {id:'members',label:'ThÃ nh viÃªn',icon:'users'},
  {id:'penalties',label:'ThÆ°á»Ÿng pháº¡t',icon:'scale'},
];

function App(){
  const[activeTab,setActiveTab]=useState('dashboard');
  const[sidebarOpen,setSidebarOpen]=useState(false);
  const[cmdOpen,setCmdOpen]=useState(false);
  const[settingsOpen,setSettingsOpen]=useState(false);
  const[adminLoginOpen,setAdminLoginOpen]=useState(false);
  const[gachaOpen,setGachaOpen]=useState(false);
  const{
    darkMode,setDarkMode,soundEnabled,setSoundEnabled,unreadCount,
    bcnUnlocked,cloudStatus,lastSynced,adminMode,setAdminMode,
    userIdentity,setUserIdentity,members,addNotification,loadTab
  }=useContext(AppCtx);

  useEffect(()=>{
    if(loadTab) loadTab(activeTab);
  },[activeTab,loadTab]);

  useEffect(()=>{
    function h(e){if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();setCmdOpen(o=>!o)}}
    document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h);
  },[]);

  const renderPage=()=>{
    switch(activeTab){
      case'dashboard':return<Dashboard setActiveTab={setActiveTab}/>;
      case'events':return<EventsPage/>;
      case'study':return<StudyHubPage/>;
      case'members':return<MembersPage/>;
      case'penalties':return<PenaltiesPage/>;
      case'decisions':return<DecisionsPage/>;
      case'resources':return adminMode ? <ResourcesPage/> : <AdminLock onUnlock={()=>setAdminMode(true)}/>;
      case'bcn':return adminMode ? <BcnRoomPage/> : <AdminLock onUnlock={()=>setAdminMode(true)}/>;
      case'notifications':return<NotificationsPage/>;
      default:return<Dashboard setActiveTab={setActiveTab}/>;
    }
  };

  return(
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={()=>setSidebarOpen(o=>!o)} className="md:hidden p-2 rounded-xl hover:bg-slate-100 transition"><Icon name="menu" size={20} className="text-slate-600"/></button>
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={()=>setActiveTab('dashboard')}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md theme-brand-bg" style={{background:'var(--brand-gradient)'}}><Icon name="eye" size={15} className="text-white"/></div>
              <div>
                <span className="font-extrabold text-slate-800 text-base tracking-tight">NewVision HUP</span>
                <span className="hidden sm:block text-[10px] text-slate-400 leading-none">CLB Ká»¹ nÄƒng má»m â€“ ÄH DÆ°á»£c HN</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* User Identity Selector */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-medium flex items-center gap-1 flex-shrink-0">
                <Icon name="user" size={13}/> TÃ´i lÃ :
              </span>
              <select
                value={userIdentity}
                onChange={e=>{
                  const val=e.target.value;
                  setUserIdentity(val);
                  localStorage.setItem('nv_user_identity',val);
                  if(val)try{addNotification(`ðŸ‘¤ ÄÃ£ nháº­n diá»‡n danh tÃ­nh: ${val}`,'info');}catch(err){}
                }}
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="">-- Chá»n tÃªn báº¡n --</option>
                {members.map(m=>(
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Gacha Daily Button */}
            <button
              onClick={()=>setGachaOpen(true)}
              title="Gieo quáº» / Bá»‘c quáº» huyá»n há»c hÃ´m nay"
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-xs shadow-xs hover:brightness-105 transition active:scale-95 flex-shrink-0"
            >
              <span>ðŸŽ´</span>
              <span className="hidden sm:inline">Quáº» HÃ´m Nay</span>
            </button>

            {/* Admin Mode Pill */}
            {adminMode ? (
              <button
                onClick={()=>{
                  setAdminMode(false);
                  try{addNotification('ÄÃ£ Ä‘Äƒng xuáº¥t cháº¿ Ä‘á»™ Quáº£n trá»‹ BCN','info');}catch(err){}
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition"
                title="Báº¥m Ä‘á»ƒ Ä‘Äƒng xuáº¥t cháº¿ Ä‘á»™ Quáº£n trá»‹ BCN"
              >
                <span>ðŸ‘‘</span>
                <span className="hidden sm:inline">Quáº£n trá»‹ [ÄÄƒng xuáº¥t]</span>
              </button>
            ) : (
              <button
                onClick={()=>setAdminLoginOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition"
                title="ÄÄƒng nháº­p Quáº£n trá»‹ BCN"
              >
                <Icon name="key" size={13}/>
                <span className="hidden sm:inline">BCN</span>
              </button>
            )}

            {/* Realtime Status Pill */}
            <button
              onClick={()=>setSettingsOpen(true)}
              title={
                cloudStatus==='connected' ? `Firebase Firestore Realtime Ä‘ang hoáº¡t Ä‘á»™ng (Äá»“ng bá»™: ${lastSynced ? lastSynced.toLocaleTimeString('vi-VN') : 'vá»«a xong'})` :
                cloudStatus==='syncing' ? 'Äang Ä‘á»“ng bá»™ dá»¯ liá»‡u lÃªn Firebase Cloud...' :
                'Cháº¿ Ä‘á»™ Ngoáº¡i tuyáº¿n / LÆ°u cá»¥c bá»™ LocalStorage (Báº¥m Ä‘á»ƒ má»Ÿ cÃ i Ä‘áº·t)'
              }
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                cloudStatus==='connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' :
                cloudStatus==='syncing' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 animate-pulse' :
                'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                cloudStatus==='connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' :
                cloudStatus==='syncing' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]' :
                'bg-slate-400'
              }`}/>
              <span className="text-[11px]">
                {cloudStatus==='connected' ? 'Cloud Live' : cloudStatus==='syncing' ? 'Äang sync...' : 'Offline'}
              </span>
            </button>

            <button onClick={()=>setCmdOpen(true)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition text-slate-500 text-sm border border-slate-200 bg-white">
              <Icon name="search" size={14}/><span className="text-xs text-slate-400">TÃ¬m kiáº¿m...</span><kbd className="text-[10px] bg-slate-100 text-slate-300 rounded px-1">Ctrl K</kbd>
            </button>
            <button onClick={()=>setCmdOpen(true)} className="sm:hidden p-2 rounded-xl hover:bg-slate-100 transition"><Icon name="search" size={20} className="text-slate-600"/></button>
            <button onClick={()=>setSoundEnabled(o=>!o)} title={soundEnabled?'Táº¯t Ã¢m thanh':'Báº­t Ã¢m thanh'} className="p-2 rounded-xl hover:bg-slate-100 transition">
              <Icon name={soundEnabled?'volume-2':'volume-x'} size={18} className="text-slate-500"/>
            </button>
            <button onClick={()=>setDarkMode(o=>!o)} title="Chuyá»ƒn sÃ¡ng/tá»‘i" className="p-2 rounded-xl hover:bg-slate-100 transition">
              <Icon name={darkMode?'sun':'moon'} size={18} className="text-slate-500"/>
            </button>
            <button onClick={()=>setSettingsOpen(true)} title="CÃ i Ä‘áº·t giao diá»‡n & há»‡ thá»‘ng" className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-600 hover:text-slate-800">
              <Icon name="settings" size={18}/>
            </button>
            <NotificationBell/>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-60 border-r border-slate-200 bg-white py-4 px-3 gap-1 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto flex-shrink-0">
          {NAV_ITEMS.map(item=>(
            <button
              key={item.id}
              onClick={()=>setActiveTab(item.id)}
              className={`sidebar-link flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left ${activeTab===item.id?'active':'text-slate-600'} ${item.isBcn?'hover:bg-amber-50/60 dark:hover:bg-amber-950/20':''}`}
            >
              <div className="flex items-center gap-3">
                <Icon name={item.icon} size={18} className={activeTab===item.id?'text-primary':item.isBcn?'text-amber-500':'text-slate-400'}/>
                <span className={item.isBcn?'font-bold text-amber-700 dark:text-amber-400':''}>{item.label}</span>
              </div>
              {item.isBcn&&(
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${bcnUnlocked?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-800'}`}>
                  {bcnUnlocked?'Má»ž':'PIN'}
                </span>
              )}
              {item.isLocked && !adminMode && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Icon name="lock" size={10}/>KhÃ³a
                </span>
              )}
            </button>
          ))}
          <button onClick={()=>setActiveTab('notifications')} className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 w-full text-left ${activeTab==='notifications'?'active':''}`}>
            <Icon name="bell" size={18} className={activeTab==='notifications'?'text-primary':'text-slate-400'}/>
            <span>ThÃ´ng bÃ¡o</span>
            {unreadCount>0&&<span className="ml-auto bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none">{unreadCount}</span>}
          </button>
          <div className="mt-auto pt-4 border-t border-slate-100 px-2">
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 theme-brand-bg" style={{background:'var(--brand-gradient)'}}><Icon name="eye" size={10} className="text-white"/></div>
              <div><p className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">NewVision HUP v2.5</p><p>ÄH DÆ°á»£c HN â€¢ Cloud Firestore âœ“</p></div>
            </div>
          </div>
        </aside>

        {sidebarOpen&&(
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/45" onClick={()=>setSidebarOpen(false)}/>
            <div className="relative bg-white w-64 flex flex-col py-4 px-3 gap-1 h-full shadow-2xl slide-down">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center theme-brand-bg" style={{background:'var(--brand-gradient)'}}><Icon name="eye" size={15} className="text-white"/></div>
                  <div><span className="font-extrabold text-slate-800">NewVision HUP</span><p className="text-[10px] text-slate-400">CLB Ká»¹ nÄƒng má»m â€“ ÄH DÆ°á»£c HN</p></div>
                </div>
                <button onClick={()=>setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><Icon name="x" size={18} className="text-slate-500"/></button>
              </div>

              {/* Mobile Identity Selector */}
              <div className="mb-2 px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">ðŸ‘¤ Báº¡n lÃ :</span>
                <select
                  value={userIdentity}
                  onChange={e=>{
                    const val=e.target.value;
                    setUserIdentity(val);
                    localStorage.setItem('nv_user_identity',val);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1 font-semibold text-slate-700"
                >
                  <option value="">-- Chá»n tÃªn báº¡n --</option>
                  {members.map(m=>(
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              {[...NAV_ITEMS,{id:'notifications',label:'ThÃ´ng bÃ¡o',icon:'bell'}].map(item=>(
                <button key={item.id} onClick={()=>{setActiveTab(item.id);setSidebarOpen(false)}} className={`sidebar-link flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left ${activeTab===item.id?'active':'text-slate-600'}`}>
                  <div className="flex items-center gap-3">
                    <Icon name={item.icon} size={18} className={activeTab===item.id?'text-primary':item.isBcn?'text-amber-500':'text-slate-400'}/>
                    <span className={item.isBcn?'font-bold text-amber-700':''}>{item.label}</span>
                  </div>
                  {item.isBcn&&<span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">{bcnUnlocked?'Má»ž':'PIN'}</span>}
                  {item.isLocked&&!adminMode&&<span className="text-[10px] text-slate-400 font-bold">KhÃ³a</span>}
                  {item.id==='notifications'&&unreadCount>0&&<span className="ml-auto bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5">{unreadCount}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 min-w-0 pb-28 md:pb-6">
          {renderPage()}
        </main>
      </div>

      <nav className="bottom-nav-bar md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 z-40 shadow-lg">
        <div className="grid grid-cols-5 h-[65px]">
          {MOBILE_NAV_ITEMS.map(item=>(
            <button key={item.id} onClick={()=>setActiveTab(item.id)} className={`bottom-nav-item flex flex-col items-center justify-center gap-1 ${activeTab===item.id?'active':''}`}>
              <Icon name={item.icon} size={19} className={`nav-icon ${activeTab===item.id?'text-orange-600':item.isBcn?'text-amber-500':'text-slate-400'}`}/>
              <span className={`nav-label text-[10.5px] font-semibold truncate max-w-full ${activeTab===item.id?'text-orange-600':item.isBcn?'text-amber-600':'text-slate-400'}`}>{item.label}</span>
              <div className="nav-dot"/>
            </button>
          ))}
        </div>
      </nav>

      <FAB setActiveTab={setActiveTab}/>
      <Mascot/>
      <ScreenCatCompanion/>
      <SettingsModal open={settingsOpen} onClose={()=>setSettingsOpen(false)}/>
      <AdminLoginModal isOpen={adminLoginOpen} onClose={()=>setAdminLoginOpen(false)} onUnlock={()=>setAdminMode(true)}/>
      <GachaModal isOpen={gachaOpen} onClose={()=>setGachaOpen(false)}/>
      <CommandPalette open={cmdOpen} onClose={()=>setCmdOpen(false)} setActiveTab={setActiveTab}/>
      <ToastContainer/>
    </div>
  );
}

const root=ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppProvider><App/></AppProvider>);
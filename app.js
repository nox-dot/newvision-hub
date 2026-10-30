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
    // Không bao giờ chặn luồng xử lý chính khi âm thanh bị trình duyệt hạn chế
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
      head = 'Thông báo';
      t = 'info';
    } else if (arguments.length === 2 && ['info', 'success', 'warning', 'error'].includes(message)) {
      t = message;
      msg = title;
      head = 'Thông báo';
    }
    if (typeof window !== 'undefined' && typeof window.__dispatchNotification === 'function') {
      window.__dispatchNotification(msg || head, t);
    }
    if (typeof notifications !== 'undefined' && Array.isArray(notifications)) {
      notifications.unshift({
        id: Date.now().toString(),
        title: head || 'Thông báo',
        message: msg || '',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        type: t,
        read: false
      });
      if (typeof renderNotifications === 'function') renderNotifications();
      if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    }
  } catch (err) {
    console.warn("Lỗi khi thêm notification:", err);
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
const BANS = ['Ban Chủ Nhiệm','Ban Sự Kiện','Ban Truyền Thông Kỹ Thuật','Ban Đối Ngoại','Ban Nội Vụ','Toàn CLB'];
const MEMBER_ROLES = ['Ban Chủ Nhiệm','Trưởng/Phó Ban','Thành viên chính thức','CTV'];
const DECISION_STATUSES = ['Đang bàn bạc','Cần duyệt','Đã chốt chính thức'];
const EVAL_OPTIONS = ['Đạt','Cần theo dõi','Không đạt'];
const ATTEND_OPTIONS = ['Có mặt','Vắng','Có phép'];
const TASK_OPTIONS = ['Đúng hạn','Trễ hạn','Chưa nộp'];
const TASK_PHASES = ['Chuẩn bị trước sự kiện','Trong thời gian sự kiện'];
const SKILL_TAGS = ['MC','Canva','Content','Hậu cần','Đối ngoại','Chụp ảnh','Quay phim','Design','Excel','Thuyết trình','Âm thanh & Ánh sáng','Trang trí','Viết Script','Social Media','Đồ hoạ','Livestream'];
const CLASS_YEARS = ['K74','K75','K76','K77','K78','K79','K80','K81','K82','K83','K84'];
const LINK_TYPES = ['Kế hoạch & Kịch bản','Bảng tính & Data','Tư liệu & Media','Biên bản & Hành chính'];
const INVENTORY_STATUSES = ['Tốt','Hỏng/Mất phụ kiện','Đang cho mượn'];
const EXPENSE_STATUSES = ['Dự trù','Đã chi - Chờ hoàn tiền','Đã quyết toán'];
const COLOR_THEMES = [
  {id:'orange',name:'Cam NewVision',sub:'Cam & Navy',c1:'#f97316',c2:'#1e3a5f',badge:'Cam & Navy'},
  {id:'indigo',name:'Tím Indigo',sub:'Indigo & Violet',c1:'#4f46e5',c2:'#7c3aed',badge:'Indigo'},
  {id:'green',name:'Xanh Dược Hà Nội',sub:'Emerald & Teal',c1:'#059669',c2:'#0f766e',badge:'Emerald'},
];
const MASCOT_TYPES = [
  {id:'vivi',name:'Cú mèo Vi Vi',icon:'🦉',desc:'Tri thức & kiên định'},
  {id:'eagle',name:'Đại bàng NewVision',icon:'🦅',desc:'Bứt phá & bản lĩnh'},
];

const GACHA_CARDS = [
  { id: 1, name: "The Sun - Hào Quang Rực Rỡ", quote: "Vũ trụ bật đèn pha chiếu thẳng vào bạn. Hôm nay vào lab chuẩn độ ra màu hồng cánh sen nhạt huyền thoại ngay lần đầu, không bị thầy cô bắt đổ đi làm lại." },
  { id: 2, name: "The Star - Ngôi Sao Hy Vọng", quote: "Một tín hiệu chữa lành từ các vì sao: Deadline khó nhằn tự động được lùi thêm 48 tiếng, hoặc bài tập nhóm bỗng có ai đó gánh hết phần việc hóc búa nhất." },
  { id: 3, name: "The Wheel of Fortune - Bánh Xe Số Phận", quote: "Bánh xe phong thủy đảo chiều ngoạn mục. Đen đủi tuần trước dừng lại ở đây; hôm nay thi trắc nghiệm lụi bừa theo linh cảm câu nào, ăn chắc câu đó." },
  { id: 4, name: "The Magician - Bậc Thầy Thao Túng", quote: "Hôm nay tài ăn nói đạt đỉnh cảnh giới. Thi vấn đáp chỉ cần mở miệng nói ba câu đúng từ khóa trọng tâm, thầy cô liền gật đầu mỉm cười cho qua môn êm đẹp." },
  { id: 5, name: "The World - Đại Cát Toàn Vẹn", quote: "Một chu kỳ sóng gió chính thức khép lại. Điểm danh vừa đủ, bài tập nộp xong trước hạn 5 phút, tối nay kê cao gối ngủ không ai dám réo tên." },
  { id: 6, name: "The Empress - Năng Lượng Trù Phú", quote: "Cung tài lộc mở rộng bất thường. Ví tiền có dấu hiệu hồi sinh nhờ được ai đó bao ăn, hoặc tài khoản nổ ting ting một khoản tiền từ trên trời rơi xuống." },
  { id: 7, name: "The Chariot - Cỗ Xe Thần Tốc", quote: "Ý chí vượt chướng ngại vật cực mạnh. Giảng viên lướt slide nhanh như chớp nhưng tay bạn ghi chép vẫn đuổi kịp trọn vẹn bản chất bài giảng." },
  { id: 8, name: "The High Priestess - Giác Quan Thứ Sáu", quote: "Trực giác mách bảo gì hãy nghe theo nấy. Tối nay linh tính bảo giở trang nào trong giáo trình thì lật đúng trang đó, xác suất trúng đề thi ngày mai lên tới 99%." },
  { id: 9, name: "Strength - Thuần Hóa Căng Thẳng", quote: "Tâm bất biến giữa dòng đời vạn biến. Khối lượng bài vở dù chất thành đống cũng bị bạn giải quyết gọn ghẽ chỉ trong một buổi chiều nghe nhạc chill." },
  { id: 10, name: "The Hermit - Thuật Tàng Hình Ẩn Sĩ", quote: "Hôm nay vận khí 'ở ẩn' che chở tuyệt đối. Giảng viên đảo mắt quanh giảng đường tìm người lên bảng nhưng ánh nhìn sẽ lướt qua bạn như thể bạn là người vô hình." },
  { id: 11, name: "The Fool - Vô Ưu Vô Lo", quote: "Cứ thong dong bước ra đường. Đi học gặp toàn đèn xanh, trời râm mát, vừa dắt xe vào trường là bắt gặp ngay một chỗ đỗ xe có bóng râm mát rượi." },
  { id: 12, name: "Temperance - Cân Bằng Âm Dương", quote: "Nguyên tố Đất và Nước hòa hợp tuyệt đối. Điểm chuyên cần và điểm thi giữa kỳ bù trừ cho nhau ra đúng con số vừa vặn qua môn không thiếu một phẩy." },
  { id: 13, name: "Judgement - Nghiệp Quả Ngọt Ngào", quote: "Những đêm cày bài trong bóng tối hôm nay được hồi đáp xứng đáng. Bảng điểm trả về hiện chữ 'ĐẠT' to đùng khiến bạn thở phào nhẹ nhõm cả người." },
  { id: 14, name: "The Hierophant - Quý Nhân Chỉ Lối", quote: "Bắt được sóng năng lượng của tiền bối khóa trên. Mượn được cuốn giáo trình có sẵn bút dạ quang highlight trúng tim đen đề thi năm nay." },
  { id: 15, name: "The Lovers - Duyên Lành Nhóm Trưởng", quote: "Vũ trụ kết nối bạn với những người đồng đội làm việc nhóm có tâm: phân công là làm, không seen tin nhắn rồi biến mất bí ẩn." },
  { id: 16, name: "Sao Thủy Thuận Hành", quote: "Tư duy logic thông suốt lạ kỳ. Mấy công thức hóa dược dài ngoằng hay sơ đồ chuyển hóa rắc rối nhìn lướt qua một lần là khắc sâu vào vỏ não." },
  { id: 17, name: "Lửa Bạch Dương Rực Cháy", quote: "Năng lượng bùng nổ. Sự trì hoãn bị đánh bại, ngồi vào bàn đúng 2 tiếng là dọn sạch toàn bộ bài tập tồn đọng của cả tuần." },
  { id: 18, name: "Đất Kim Ngưu Vững Chãi", quote: "Hôm nay ví tiền được bảo vệ an toàn. Xuống căng-tin giờ cao điểm vẫn chộp được suất cơm ngon lành, no căng bụng với giá sinh viên." },
  { id: 19, name: "Nước Cự Giải Êm Đềm", quote: "Tâm trí bình yên như mặt hồ không một gợn sóng. Không drama, không tin nhắn giục việc, chỉ có sự thảnh thơi trọn vẹn cả ngày dài." },
  { id: 20, name: "Sao Mộc Bảo Hộ", quote: "Vận may đến vào phút chót: Đi học sát giờ nhưng vừa đặt chân qua cửa lớp thì tiếng chuông điểm danh mới bắt đầu vang lên." },
  { id: 21, name: "Sao Kim Duyên Dáng", quote: "Hôm nay bạn tỏa ra nguồn năng lượng dễ mến lạ thường. Đi thực tập hay lên lớp đều được mọi người xung quanh nhiệt tình giúp đỡ, nhường nhịn từng chút." },
  { id: 22, name: "Quẻ Thuần Càn - Vận Khí Thăng Hoa", quote: "Mọi sự khởi đầu hôm nay đều trơn tru như bôi dầu. Nộp báo cáo qua web trường mạng chạy vèo vèo, không gặp cảnh xoay vòng tròn ức chế." },
  { id: 23, name: "Quẻ Địa Thiên Thái - Hóa Nguy Thành An", quote: "Tưởng chừng quên mang theo tài liệu học tập, hóa ra bạn cùng bàn đã in dư một bản rồi đưa ngay cho bạn dùng." },
  { id: 24, name: "Quẻ Thủy Hỏa Ký Tế - Tròn Vẹn Ý Nguyện", quote: "Tiến độ ôn thi đã vào guồng chuẩn chỉ. Chỉ cần giữ vững nhịp độ này, bạn cầm chắc chiếc vé qua môn với số điểm đẹp mắt." },
  { id: 25, name: "Quẻ Phong Lôi Ích - Trí Não Bứt Phá", quote: "Não bộ hôm nay tiếp thu kiến thức với tốc độ cáp quang. Mấy câu hỏi hóc búa tưởng không giải nổi bỗng nhiên tìm ra chìa khóa đáp án." },
  { id: 26, name: "Sao Thổ Lùi Bước", quote: "Áp lực lớn nhất của tuần đã chính thức tan biến. Hôm nay là ngày tự thưởng cho bản thân một buổi chiều đi dạo hoặc nằm dài lướt web." },
  { id: 27, name: "Tín Hiệu Mặt Trăng", quote: "Mắt thần mở ra. Soi kính hiển vi bắt dính vi trường nét căng ngay vòng vặn ốc vi cấp đầu tiên, bạn bè xung quanh bu lại xin chụp ké lia lịa." },
  { id: 28, name: "Thiên Thời Địa Lợi", quote: "Thời tiết chiều lòng người. Vừa tan học dắt xe ra cổng thì trời râm mát, về đến tận phòng trọ khóa cửa xong bên ngoài mới bắt đầu trút mưa rào." },
  { id: 29, name: "Khiên Chắn Tâm Linh", quote: "Vận xui tự động bật ngược ra xa. Vào phòng thực tập làm việc êm ru: không vỡ ống nghiệm, không đổ hóa chất, an toàn lành lặn đi về." },
  { id: 30, name: "Quẻ Hỏa Địa Tấn - Tỏa Sáng", quote: "Bài phát biểu hoặc câu trả lời ngẫu hứng trong lớp khiến giảng viên phải mỉm cười gật gù khen ngợi trước mặt bạn bè." },
  { id: 31, name: "Thiên Thần 111 - Ý Niệm Thành Hiện Thực", quote: "Vũ trụ đang lắng nghe suy nghĩ của bạn. Lúc làm bài trắc nghiệm, hãy kiên định chọn đáp án đầu tiên lóe lên trong đầu, đừng xóa đi chọn lại." },
  { id: 32, name: "Thiên Thần 222 - Bình Tâm Chờ Đợi", quote: "Mọi sự an bài đều diễn ra đúng lúc. Đừng quá sốt ruột chờ điểm số, kết quả trả về sẽ khiến bạn thở phào nở nụ cười." },
  { id: 33, name: "Thiên Thần 333 - Quý Nhân Vây Quanh", quote: "Hôm nay xung quanh toàn người tốt bụng. Đang bí bài tập khó chỉ cần buông một câu than thở là có người giảng giải cặn kẽ từng bước." },
  { id: 34, name: "Thiên Thần 444 - Hào Quang Bất Khả Xâm Phạm", quote: "Bạn được bao bọc bởi một lớp khiên năng lượng bình yên. Mọi lời phàn nàn xung quanh đều trôi tuột ra ngoài, tâm trạng không chút gợn sóng." },
  { id: 35, name: "Thiên Thần 555 - Lối Rẽ Bất Ngờ", quote: "Sắp có một tin tức mang lại niềm vui nho nhỏ: Một tiết học được đổi sang hình thức nhẹ nhàng hơn hoặc bất ngờ được cho nghỉ sớm." },
  { id: 36, name: "Thiên Thần 777 - Khai Thông Trí Tuệ", quote: "Túi khôn hôm nay mở rộng hết cỡ. Gặp bài toán hóc búa tự dưng đầu óc nảy số ra cách làm nhanh gọn bất ngờ." },
  { id: 37, name: "Thiên Thần 888 - Tài Khí Dồi Dào", quote: "Dòng chảy tiền bạc hanh thông. Thò tay vào túi áo khoác cũ bỗng tìm lại được tờ tiền gấp gọn ngỡ đã đánh rơi từ tuần trước." },
  { id: 38, name: "Thiên Thần 999 - Trọn Vẹn Chu Kỳ", quote: "Gác lại toàn bộ những lo âu của bài vở ngày cũ. Tối nay bạn xứng đáng được thưởng một ly trà sữa ngọt ngào và một giấc ngủ say không mộng mị." },
  { id: 39, name: "Con Số 000 - Tiềm Năng Vô Cực", quote: "Ngày hôm nay là một trang giấy hoàn toàn mới. Mọi may mắn đều nằm trong tay bạn, tự tin bước đi là gặt hái kết quả tốt." },
  { id: 40, name: "Lá Bài Định Mệnh - Vận Đỏ Toàn Diện", quote: "Lá quẻ may mắn nhất trong ngày. Mọi sự mong cầu từ việc tránh bị gọi tên, trúng đề thi đến thời tiết khô ráo đều diễn ra đúng như ý bạn mong muốn." }
];
const MASCOT_MESSAGES = [
  'NewVision cố lên! 💪','Team mình làm tốt lắm! 🌟','Hôm nay năng suất siêu cao! 🚀',
  'Vi Vi tự hào về các bạn! 🦉','Cùng nhau làm điều tuyệt vời! ✨','Focus mode: ON! 🎯',
  'NewVision – Tầm nhìn mới, Bứt phá mới! 🔥','Chỉ còn chút nữa thôi, cố lên! 💫',
  'Mỗi việc nhỏ tạo nên điều lớn! 🌈','Hít thở sâu, mọi thứ sẽ ổn! 🌸',
];
const EAGLE_MESSAGES = [
  'Đại bàng NewVision tung cánh! 🦅','Tầm nhìn mới, Bứt phá mới! 🚀','Mục tiêu đã định, tiến lên nào! 🎯',
  'Bay cao và xa hơn mỗi ngày! ✨','Tập trung cao độ – Không gì là không thể! 🔥','Bản lĩnh NewVision dẫn lối! 🌟',
  'Làm việc hết mình, bùng nổ hết sức! ⚡','NewVision – Khẳng định vị thế! 🏆',
];
const DEFAULT_VENUE_ITEMS = [
  {id:'chairs',label:'Bàn ghế',icon:'armchair'},
  {id:'projector',label:'Máy chiếu',icon:'monitor'},
  {id:'ac',label:'Điều hòa',icon:'wind'},
  {id:'speaker',label:'Loa & Mic',icon:'volume-2'},
  {id:'refreshments',label:'Nước & Bánh kẹo',icon:'coffee'},
  {id:'gifts',label:'Quà khách mời',icon:'gift'},
];
const LINK_TYPE_CFG = {
  'Kế hoạch & Kịch bản':{icon:'file-text',bg:'bg-blue-100',text:'text-blue-600',border:'border-blue-200'},
  'Bảng tính & Data':{icon:'table-2',bg:'bg-emerald-100',text:'text-emerald-600',border:'border-emerald-200'},
  'Tư liệu & Media':{icon:'image',bg:'bg-purple-100',text:'text-purple-600',border:'border-purple-200'},
  'Biên bản & Hành chính':{icon:'stamp',bg:'bg-amber-100',text:'text-amber-600',border:'border-amber-200'},
};

// ============================================================
// UTILS
// ============================================================
function uid(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36)}
function fmtDate(d){if(!d)return'—';const dt=new Date(d);return isNaN(dt.getTime())?d:dt.toLocaleDateString('vi-VN')}
function fmtVND(n){if(n===undefined||n===null||n==='')return'—';return new Intl.NumberFormat('vi-VN').format(Number(n))+'₫'}
function isOverdue(dateStr){if(!dateStr)return false;return new Date(dateStr)<new Date()}
function isSoon(dateStr){if(!dateStr)return false;const diff=new Date(dateStr)-new Date();return diff>0&&diff<24*3600*1000}
function relTime(isoStr){const diff=Date.now()-new Date(isoStr).getTime();const m=Math.floor(diff/60000);const h=Math.floor(m/60);const d=Math.floor(h/24);if(m<1)return'Vừa xong';if(m<60)return`${m} phút trước`;if(h<24)return`${h} giờ trước`;if(d<7)return`${d} ngày trước`;return new Date(isoStr).toLocaleDateString('vi-VN')}
function statusColor(s){if(s==='Đã chốt chính thức')return'tag-green';if(s==='Cần duyệt')return'tag-yellow';return'tag-blue'}
function evalColor(e){if(e==='Đạt')return'tag-green';if(e==='Không đạt')return'tag-red';return'tag-yellow'}
function taskColor(t){if(t==='Đúng hạn')return'tag-green';if(t==='Trễ hạn')return'tag-red';return'tag-gray'}
function attendColor(a){if(a==='Có mặt')return'tag-green';if(a==='Vắng')return'tag-red';return'tag-yellow'}
function expenseColor(s){if(s==='Đã quyết toán')return'tag-green';if(s==='Đã chi - Chờ hoàn tiền')return'tag-yellow';return'tag-blue'}
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
    title: 'Tổng hợp Bộ đề thi Dược lý 1 (K77 - K79) có đáp án chi tiết',
    block: 'Cơ sở ngành',
    category: 'Đề thi & Đáp án',
    url: 'https://drive.google.com/drive/folders/newvision-duocly1',
    contributor: 'BCN Học tập NVC',
    note: 'Tài liệu trọng tâm ôn thi hết môn, bám sát cấu trúc đề trắc nghiệm và ca lâm sàng.',
    pinned: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    title: 'Tóm tắt Sơ đồ tư duy Hóa Dược 2 (Kháng sinh & Tim mạch)',
    block: 'Chuyên ngành Dược',
    category: 'Tóm tắt lý thuyết',
    url: 'https://drive.google.com/drive/folders/newvision-hoaduoc2',
    contributor: 'Trần Minh Quân - K77',
    note: 'Sơ đồ cơ chế tác dụng, phân loại và liên quan cấu trúc - tác dụng (SAR).',
    pinned: true,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    title: 'Slide bài giảng & Câu hỏi lượng giá Giải phẫu - Sinh lý',
    block: 'Đại cương',
    category: 'Slide bài giảng',
    url: 'https://drive.google.com/drive/folders/newvision-giaiphau',
    contributor: 'Ban Chuyên môn NVC',
    note: 'Trọn bộ slide giảng đường và ngân hàng câu hỏi ôn tập giữa kỳ.',
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
  const[qrAccounts,setQrAccounts]=useState({});
  const[clubFunds,setClubFunds]=useState([]);
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
      const pushTitle=type==='error'?'🚨 BÁO ĐỘNG SOS - NewVision HUP':type==='success'?'✨ NewVision HUP':type==='warning'?'⚠️ NewVision HUP':'📢 NewVision HUP';
      showWebPush(pushTitle,message,{tag:type,requireInteraction:type==='error'});
    }catch(err){
      console.warn('Lỗi khi thêm notification:',err);
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
      alert('Trình duyệt của bạn không hỗ trợ Web Notification.');
      return false;
    }
    try{
      const perm=await Notification.requestPermission();
      setPushPermission(perm);
      if(perm==='granted'){
        showWebPush('🔔 NewVision HUP','Thông báo đẩy Web Push đã được kích hoạt thành công!');
        try{playSound('success');}catch(e){}
        showToast('Đã bật thông báo đẩy Web Push!','success');
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
        showToast('Bạn đã từ chối quyền gửi thông báo.','warning');
        return false;
      }
    }catch(e){
      console.warn('requestPermission error:',e);
      return false;
    }
  },[playSound,showToast]);

  // Realtime Firestore LAZY LOAD: Khi vừa mở trang CHỈ lắng nghe tab Tổng quan (dashboard)
  // Dữ liệu các tab khác chỉ bắt đầu tải khi người dùng click vào tab đó
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

            // Khử trùng lặp cho thành viên nếu có bản ghi trùng
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

    // 1. CHỈ TẢI TAB TỔNG QUAN KHI VỪA MỞ TRANG (Checklist & Quick links):
    listenCol('quickChecklist',setQuickChecklist,list=>list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));
    listenCol('quickLinks',setQuickLinks,list=>list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));

    // 2. LAZY LOAD - CHỈ TẢI CÁC TAB KHÁC KHI ĐƯỢC KÍCH HOẠT:
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
      if(!activeUnsubsRef.current['club_qr_accounts']){
        try{
          const unsubQr=fbDb.collection('club_qr_accounts').onSnapshot(snap=>{
            const accs={};
            snap.docs.forEach(d=>{
              const data=d.data()||{};
              accs[d.id]=data;
              if(data.unit) accs[data.unit]=data;
            });
            setQrAccounts(accs);
            if(accs['all']||accs['clb_common']){
              setPenaltyAccount(accs['all']||accs['clb_common']);
            }
            setCloudStatus('connected');
            setLastSynced(new Date());
          },err=>console.warn('club_qr_accounts sync error:',err));
          activeUnsubsRef.current['club_qr_accounts']=unsubQr;
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
      listenCol('club_funds',setClubFunds,list=>list.sort((a,b)=>(b.date||b.createdAt||'').localeCompare(a.date||a.createdAt||'')));
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

  // Tải trước nhẹ nhàng số liệu tổng quan (events, members, decisions) sau 2.5s khi máy rảnh
  useEffect(()=>{
    const idleTimer=setTimeout(()=>{
      loadTab('events');
      loadTab('members');
      loadTab('decisions');
    },2500);
    return()=>clearTimeout(idleTimer);
  },[loadTab]);

  // Hoãn di chuyển dữ liệu cũ sau 6s để trang mở tức thì dưới 1s
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
    if(!fbDb){alert('Firebase chưa được khởi tạo.');return}
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
      showToast('Đã đồng bộ toàn bộ dữ liệu lên Cloud Firestore thành công!','success');
    }catch(err){
      console.error('pushAllToCloud error:',err);
      setCloudStatus('offline');
      alert('Lỗi lưu Firebase: '+err.message);
    }
  },[members,events,decisions,expenses,resources,studyResources,penalties,inventory,sessions,assignTasks,quickChecklist,quickLinks,bcnPlans,bcnNotes,playSound,showToast]);

  const pullAllFromCloud=useCallback(async()=>{
    if(!fbDb){alert('Firebase chưa được khởi tạo.');return}
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
      showToast('Đã tải lại toàn bộ dữ liệu từ Cloud Firestore thành công!','success');
    }catch(err){
      console.error('pullAllFromCloud error:',err);
      setCloudStatus('offline');
      alert('Lỗi tải dữ liệu Firebase: '+err.message);
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
      adminMode,setAdminMode,userIdentity,setUserIdentity,clubRules,setClubRules,penaltyAccount,setPenaltyAccount,qrAccounts,setQrAccounts,clubFunds,setClubFunds,
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
        type: 'Góc học tập',
        title: item.title || 'Tài liệu',
        creator: item.contributor || 'Thành viên CLB',
        rawUrl: item.url
      };
    }
  }

  // 2. Check in resources (links)
  for (const item of resources) {
    if (item.id && item.id === excludeId) continue;
    if (item.url && normalizeUrl(item.url) === normTarget) {
      return {
        type: 'Tài nguyên',
        title: item.title || 'Liên kết',
        creator: item.ban ? ('Ban ' + item.ban) : (item.creator || 'Ban Quản trị'),
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
            type: 'Sự kiện: ' + (ev.name || ''),
            title: t.title || 'Công việc',
            creator: t.assignee || 'Ban Tổ chức',
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
              type: 'Góc học tập',
              title: d.title || 'Tài liệu',
              creator: d.contributor || 'Thành viên CLB'
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
              type: 'Tài nguyên',
              title: d.title || 'Liên kết',
              creator: d.ban ? ('Ban ' + d.ban) : 'Ban Quản trị'
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
          Cảnh báo trùng lặp liên kết
        </h3>
        <p className="text-sm text-center text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          Link này đã tồn tại trong hệ thống (do <span className="font-bold text-amber-600 dark:text-amber-400">{creator || 'Thành viên CLB'}</span> đăng). Bạn có chắc chắn muốn thêm lại không?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition text-center"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md transition text-center"
          >
            Vẫn lưu
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
          <div><p className="font-semibold text-slate-800">Xác nhận xóa</p><p className="text-sm text-slate-500 mt-0.5">{message}</p></div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={()=>{onConfirm();onClose()}} className="btn-danger">Xóa</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MASCOT "Vi Vi" (Cú Mèo) & "Đại Bàng NewVision"
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
          <text x="12" y="24" fontSize="14">⭐</text>
          <text x="76" y="22" fontSize="14">✨</text>
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
          <text x="16" y="27" fontSize="13">⭐</text>
          <text x="73" y="23" fontSize="11">✨</text>
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
  const mascotTitle=mascotType==='eagle'?'Đại bàng NewVision – Bấm để nhận lời cổ vũ!':'Vi Vi – Bấm để nhận lời cổ vũ!';

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
      <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center">⚡ {energy}% NL CLB</p>
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

  // Lắng nghe thao tác người dùng toàn trang: sau 20s không chạm web, mèo tự động ngủ
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

  // Sự kiện kích hoạt từ hệ thống (khi hoàn thành task hoặc sự kiện đặc biệt)
  useEffect(()=>{
    if(!catEnabled||!catEvent)return;
    if(catEvent.action==='dash'){
      setState('dash');
      setFacing(1);
      showCatSpeech('Vèo vèo~! 🚀🐾',1500);
      try{playSound('pop');}catch(e){}
      const newSparks=Array.from({length:6},(_,i)=>({
        id:Date.now()+i,x:Math.random()*40-20,y:Math.random()*20-10,emoji:['✨','⭐','💫'][i%3]
      }));
      setSparks(newSparks);
      setTimeout(()=>setSparks([]),1500);
      setTimeout(()=>setState('idle'),1600);
    }else if(catEvent.action==='celebrate'){
      setState('celebrate');
      try{playSound('success');}catch(e){}
      showCatSpeech('Hoan hô! Xong việc rồi! 🎉🐱',1500);
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

  // Xử lý kéo thả (Pointer move / Pointer up)
  useEffect(()=>{
    if(!catEnabled)return;
    const handlePointerMove=e=>{
      if(!isPointerDownRef.current)return;
      const clientX=e.clientX??e.touches?.[0]?.clientX;
      const clientY=e.clientY??e.touches?.[0]?.clientY;
      if(clientX===undefined||clientY===undefined)return;

      const dist=Math.hypot(clientX-dragStartRef.current.x,clientY-dragStartRef.current.y);
      // Nếu di chuyển quá 6px, xác định đây là hành động kéo (drag) chứ KHÔNG PHẢI click
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
        // Đánh dấu vừa kéo thả để chặn sự kiện click chuột ăn theo
        justFinishedDragRef.current=true;
        setTimeout(()=>{justFinishedDragRef.current=false},250);

        // Thả mèo ở đâu thì cho phép mèo đứng ở đó một lát (15 giây không tự động đi dạo)
        lastInteractionTimeRef.current=now;

        const floorY=getFloorY();
        if(pos.y<floorY-15){
          setState('fall');
          vyRef.current=0;
        }else{
          setPos(p=>({...p,y:floorY}));
          setState('idle');
        }
        // TUYỆT ĐỐI KHÔNG kích hoạt hiệu ứng pháo hoa hay chúc mừng khi người dùng vừa kéo thả mèo xong
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

  // Hiệu ứng rơi bung dù khi thả từ trên cao
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

  // Vòng lặp hành vi tự nhiên: 20s idle ngủ, 10s sau thả mới đi dạo, quay lại lề an toàn
  useEffect(()=>{
    if(!catEnabled)return;
    const interval=setInterval(()=>{
      if(isPointerDownRef.current||state==='fall'||state==='drag'||state==='dash'||state==='celebrate'||state==='landing'||state==='bounce')return;
      const now=Date.now();

      // Trạng thái nhàn rỗi (Idle): Khi người dùng không chạm vào web 20 giây, mèo tự động chuyển tư thế nằm ngủ
      if(now-lastUserActivityRef.current>=20000){
        if(state!=='sleep')setState('sleep');
        return;
      }

      // Sau 15 giây không tương tác: tự động đưa mèo về góc lề an toàn
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

      // Thả mèo ở đâu thì đứng yên 15 giây trước khi tự động đi dạo
      if(now-lastInteractionTimeRef.current<15000)return;

      // Nếu nằm sát viền quá (lề trái < 25px hoặc lề phải > width - 75px), quay lại lề an toàn
      if(pos.x<25||pos.x>window.innerWidth-75){
        const safeX=pos.x<25?70:window.innerWidth-120;
        targetXRef.current=safeX;
        setFacing(safeX>pos.x?1:-1);
        setState('walk');
        return;
      }

      // Đi dạo nhẹ nhàng thong thả
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

  // Bước chân khi đi dạo
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

  // Xử lý CLICK CHỦ ĐỘNG vào chú mèo
  const handleClick=()=>{
    // Nếu di chuyển quá 6px hoặc vừa kéo thả xong thì KHÔNG PHẢI click
    if(hasDraggedRef.current||justFinishedDragRef.current)return;

    const now=Date.now();
    lastUserActivityRef.current=now;
    lastInteractionTimeRef.current=now;

    if(state==='sleep'){
      setState('idle');
    }

    // Cờ chống spam (cooldown 3 giây): Nếu bấm liên tục chỉ nhấp nháy mắt, không nhảy chữ dồn dập
    if(now-lastClickTimeRef.current<3000){
      setIsBlinking(true);
      setTimeout(()=>setIsBlinking(false),350);
      return;
    }
    lastClickTimeRef.current=now;

    // Tuyệt đối KHÔNG bắn pháo hoa confetti toàn màn hình
    // Phản hồi ngẫu nhiên 1 trong các hành động dễ thương:
    const choice=Math.floor(Math.random()*3);
    if(choice===0){
      // 1. Kêu "Meow! 🐾" nhẹ kèm âm thanh nhỏ
      try{playSound('pop');}catch(e){}
      showCatSpeech('Meow! 🐾',1500);
    }else if(choice===1){
      // 2. Nhảy dựng lên nhẹ (hiệu ứng bounce/nhún chân 0.3s)
      try{playSound('pop');}catch(e){}
      setState('bounce');
      setTimeout(()=>setState('idle'),320);
      showCatSpeech('Boing! 🐾 Cố lên nhé!',1500);
    }else{
      // 3. Hiện bóng thoại ngắn 1.5s tự biến mất
      const msgs=[
        'Cố lên NVC! 🔥',
        'Tập trung học tập nhé! 📚',
        'NewVision đỉnh nóc kịch trần! ✨',
        'Nghỉ ngơi uống nước nhé! 🍵'
      ];
      const msg=msgs[Math.floor(Math.random()*msgs.length)];
      try{playSound('pop');}catch(e){}
      showCatSpeech(msg,1500);
    }
  };

  // Click đúp (double click) vào mèo để quay về vị trí ban đầu
  const handleDoubleClick=e=>{
    if(e&&e.stopPropagation)e.stopPropagation();
    const floorY=getFloorY();
    setPos({x:120,y:floorY});
    setState('idle');
    setFacing(1);
    showCatSpeech('Meow~! 🐱 Về chỗ cũ rồi!',1500);
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
      title="Bé mèo NewVision – Kéo thả hoặc click để chơi đùa, click đúp để về chỗ cũ!"
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
      exportedAt:new Date().toISOString(),version:'2.5',clb:'NewVision HUP – CLB Kỹ năng mềm ĐH Dược HN',
      decisions,events,members,sessions,assignTasks,quickChecklist,quickLinks,
      resources,inventory,expenses,notifications:notifications.slice(0,100),
    },`newvision-hup-${new Date().toISOString().slice(0,10)}.json`);
    try{playSound('success');}catch(e){}
    try{addNotification('📦 Đã xuất backup dữ liệu thành công!','success');}catch(e){}
  };

  const handleImport=e=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=async ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(!fbDb){
          alert('Lỗi lưu Firebase: Chưa kết nối được Firebase Firestore!');
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
        try{addNotification('✅ Nhập dữ liệu backup lên Cloud Firestore thành công!','success');}catch(e){}
        onClose();
      }catch(err){
        console.error('Import error:',err);
        alert('Lỗi lưu Firebase: '+err.message);
      }
    };
    reader.readAsText(file);
    e.target.value='';
  };

  return(
    <Modal open={open} onClose={onClose} title="Cài Đặt Hệ Thống & Giao Diện" wide>
      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">🎨 Tùy chọn Theme màu chủ đạo</label>
          <div className="grid sm:grid-cols-3 gap-3">
            {COLOR_THEMES.map(t=>(
              <div
                key={t.id}
                onClick={()=>{setTheme(t.id);try{playSound('pop');}catch(e){}}}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${theme===t.id?'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm':'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full shadow-inner flex items-center justify-center text-white text-[10px]" style={{background:t.c1}}>✓</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{t.name}</span>
                  </div>
                  {theme===t.id&&<span className="text-[10px] bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-full">Đang dùng</span>}
                </div>
                <div className="h-2 rounded-full mb-2" style={{background:`linear-gradient(90deg, ${t.c1}, ${t.c2})`}}/>
                <p className="text-[11px] text-slate-400 leading-snug">{t.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">🦉 Tùy chọn Linh vật CLB</label>
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
                    {mascotType===m.id&&<span className="text-[10px] bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded-full">Đang dùng</span>}
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
              <span className="text-2xl">🐱</span>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Bé Mèo Chạy Màn Hình</p>
                <p className="text-[11px] text-slate-400">Pet ảo xả stress, kéo thả và vờn chuột</p>
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
              <span className="text-2xl">🔊</span>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Âm Thanh Hiệu Ứng</p>
                <p className="text-[11px] text-slate-400">Âm thanh vui tai khi chốt việc & SOS</p>
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
              Trạng thái: <span className="font-bold text-emerald-600 dark:text-emerald-400">● Đã đồng bộ Cloud</span>
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
                <Icon name="bell" size={14}/> Bật Thông Báo Đẩy (Web Push)
              </button>
            ) : (
              <button
                onClick={()=>{
                  showWebPush('🎉 Test Thông Báo Web Push','Hệ thống thông báo đẩy NewVision HUP đang hoạt động hoàn hảo trên máy tính của bạn!');
                  try{playSound('success');}catch(e){}
                  try{addNotification('🧪 Đã gửi thử thông báo đẩy Web Push lên màn hình!','success');}catch(e){}
                }}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-slate-700 hover:text-blue-600"
              >
                <Icon name="send" size={14}/> 🧪 Bắn Thử Thông Báo
              </button>
            )}

            <button
              onClick={pushAllToCloud}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Ghi đè dữ liệu hiện tại lên Cloud Firestore"
            >
              <Icon name="upload-cloud" size={14}/> Đẩy Lên Cloud (Push)
            </button>

            <button
              onClick={pullAllFromCloud}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Tải lại toàn bộ dữ liệu mới nhất từ Cloud Firestore"
            >
              <Icon name="download-cloud" size={14}/> Kéo Từ Cloud (Pull)
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">💾 Sao Lưu & Đồng Bộ Dữ Liệu</label>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Icon name="download" size={20}/>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Xuất Backup (JSON)</p>
                <p className="text-[11px] text-slate-400">Tải file dữ liệu lưu về máy</p>
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
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Nhập Backup (JSON)</p>
                <p className="text-[11px] text-slate-400">Đồng bộ từ file backup có sẵn</p>
              </div>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>NewVision HUP v2.5 Pro · ĐH Dược Hà Nội</span>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-4">Đóng</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// PHÒNG BAN CHỦ NHIỆM (BCN SECRET HUB)
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
  const emptyPlan={title:'',deadline:'',level:'Tuyệt mật',pic:'',content:'',milestones:[]};
  const[planForm,setPlanForm]=useState(emptyPlan);

  const handleSavePin=()=>{
    if(!pinEdit.trim()||pinEdit.length<4){alert('Mã PIN mới phải có ít nhất 4 ký tự!');return}
    setBcnPin(pinEdit.trim());
    setPinSaved(true);
    try{playSound('success');}catch(e){}
    try{addNotification('🔒 Đã đổi mã PIN Ban Chủ Nhiệm thành công!','success');}catch(e){}
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
      try{addNotification('🔓 Mở khóa thành công Phòng Ban Chủ Nhiệm!','success');}catch(e){}
      setPinInput('');
    }else{
      setShaking(true);
      try{playSound('sos');}catch(e){}
      try{addNotification('Mã PIN không chính xác! Vui lòng thử lại.','error');}catch(e){}
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
    try{addNotification('🔒 Đã khóa Phòng Ban Chủ Nhiệm an toàn!','info');}catch(e){}
  };

  const saveMemberBcnNote=async(memberId,noteText)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('bcnNotes').doc('general').set({
        data:{...bcnNotes,[memberId]:noteText}
      },{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification('📝 Đã lưu ghi chú BCN cho thành viên!','success');}catch(e){}
    }catch(err){
      console.error('Lỗi lưu ghi chú BCN:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const setMemberEval=async(memberId,newEval)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('members').doc(memberId).set({eval:newEval},{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification(`Đã cập nhật đánh giá thành viên thành: ${newEval}`,'info');}catch(e){}
    }catch(err){
      console.error('Lỗi lưu đánh giá thành viên:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const handleApproveExpense=async(exp)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('expenses').doc(exp.id).set({status:'Đã quyết toán'},{merge:true});
      try{playSound('success');}catch(e){}
      triggerCat('celebrate');
      try{addNotification(`✅ Đã duyệt quyết toán cho ${exp.person||'thành viên'}: ${fmtVND(exp.amount)}`,'success');}catch(e){}
    }catch(err){
      console.error('Lỗi duyệt quyết toán:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const handleRejectExpense=async(exp)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('expenses').doc(exp.id).set({
        status:'Cần giải trình',
        note:(exp.note||'')+' [BCN yêu cầu giải trình thêm]'
      },{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification(`⚠️ Đã yêu cầu giải trình khoản chi "${exp.name}"`,'warning');}catch(e){}
    }catch(err){
      console.error('Lỗi từ chối quyết toán:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const openAddPlan=()=>{setEditingPlan(null);setPlanForm(emptyPlan);setPlanModal(true)};
  const openEditPlan=p=>{setEditingPlan(p.id);setPlanForm({...p});setPlanModal(true)};
  const handleSavePlan=async()=>{
    if(!planForm.title.trim()){alert('Vui lòng nhập tên chiến lược!');return}
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
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
      try{addNotification('🎯 Đã lưu kế hoạch tác chiến mật!','success');}catch(e){}
    }catch(err){
      console.error('Lỗi lưu kế hoạch BCN:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const toggleMilestone=async(planId,mId)=>{
    const pl=bcnPlans.find(x=>x.id===planId);
    if(!pl)return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const updatedMilestones=(pl.milestones||[]).map(m=>m.id===mId?{...m,done:!m.done}:m);
      await fbDb.collection('bcnPlans').doc(planId).set({milestones:updatedMilestones},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi cập nhật mốc tiến độ:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const handleDeletePlan=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('bcnPlans').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('Đã xóa kế hoạch BCN','info');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa kế hoạch:',err);
      alert('Lỗi lưu Firebase: '+err.message);
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
      const isBadEval=m.eval==='Cần theo dõi'||m.eval==='Không đạt';
      const presentCount=sessions.filter(s=>m.attendance?.[s.id]==='Có mặt').length;
      const attPct=totalSessions>0?Math.round(presentCount/totalSessions*100):100;
      const trackedTasks=assignTasks.filter(t=>m.taskStatus?.[t.id]);
      const onTimeCount=trackedTasks.filter(t=>m.taskStatus?.[t.id]==='Đúng hạn').length;
      const taskPct=trackedTasks.length>0?Math.round(onTimeCount/trackedTasks.length*100):100;
      return isBadEval||attPct<60||taskPct<60;
    });
  },[members,sessions,assignTasks,totalSessions]);

  const pendingExpenses=useMemo(()=>{
    return expenses.filter(e=>e.status==='Đã chi - Chờ hoàn tiền'||(Number(e.amount)||0)>=300000);
  },[expenses]);

  if(!bcnUnlocked){
    return(
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className={`card max-w-sm w-full p-6 text-center shadow-2xl border-2 border-amber-300 dark:border-amber-900/60 bg-gradient-to-b from-white to-amber-50/30 dark:from-slate-800 dark:to-slate-900 ${shaking?'shake-keypad':''}`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg pulse-shield">
            <Icon name="shield-alert" size={32}/>
          </div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">Khu Vực Bảo Mật BCN</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">Nhập mã PIN để truy cập phòng tác chiến kín</p>
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
              Xóa
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
              ⌫
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
              Phòng Ban Chủ Nhiệm (BCN Secret Hub)
              <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">ĐÃ MỞ KHÓA</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Không gian quản trị tối mật dành cho BCN NewVision</p>
          </div>
        </div>
        <button onClick={handleLockNow} className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3">
          <Icon name="lock" size={14}/>Khóa Phòng Ngay
        </button>
      </div>

      {/* KHU VỰC THIẾT LẬP MÃ PIN BẢO MẬT BCN */}
      <div className="card p-3.5 border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Icon name="key" size={16}/>
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Đổi Mã PIN Ban Chủ Nhiệm</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Chỉ thành viên BCN đã mở khóa mới có quyền đổi mã này</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            maxLength={8}
            value={pinEdit}
            onChange={e=>setPinEdit(e.target.value)}
            className="form-input text-xs font-mono tracking-widest text-center w-28 py-1.5"
            placeholder="PIN mới..."
          />
          <button onClick={handleSavePin} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
            {pinSaved ? '✓ Đã Lưu' : 'Lưu PIN'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          ['radar','🚨 Radar Nhân Sự Nhạy Cảm',alertMembers.length],
          ['expenses','💰 Duyệt Quỹ & Chi Phí Lớn',pendingExpenses.length],
          ['plans','🎯 Kế Hoạch Tác Chiến Mật',bcnPlans.length],
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
              <p className="text-xs text-slate-400">Tổng Cảnh Báo</p>
              <p className="text-2xl font-black text-red-500">{alertMembers.length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Thành viên / CTV cần can thiệp</p>
            </div>
            <div className="card p-3 border-l-4 border-amber-500">
              <p className="text-xs text-slate-400">Cần Theo Dõi</p>
              <p className="text-2xl font-black text-amber-500">{alertMembers.filter(m=>m.eval==='Cần theo dõi').length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Cần nhắc nhở & hỗ trợ</p>
            </div>
            <div className="card p-3 border-l-4 border-rose-600">
              <p className="text-xs text-slate-400">Không Đạt</p>
              <p className="text-2xl font-black text-rose-600">{alertMembers.filter(m=>m.eval==='Không đạt').length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Xem xét cho thôi sinh hoạt</p>
            </div>
          </div>

          {alertMembers.length===0?(
            <div className="card py-16 text-center">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">Không có nhân sự nào trong danh sách cảnh báo!</p>
              <p className="text-xs text-slate-400 mt-1">Toàn bộ thành viên và CTV đều có tinh thần làm việc và tham gia đạt chuẩn.</p>
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
                          <span className={`status-badge text-[11px] ${evalColor(m.eval||'Đạt')}`}>{m.eval}</span>
                          <span className="status-badge tag-gray text-[11px]">{m.role}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{m.ban||'Chưa phân ban'} · {m.khoa||''} {m.phone?`· 📞 ${m.phone}`:''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={()=>setMemberEval(m.id,'Đạt')} className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg">Chuyển "Đạt"</button>
                      <button onClick={()=>setMemberEval(m.id,'Cần theo dõi')} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-2.5 py-1 rounded-lg">Cần theo dõi</button>
                      <button onClick={()=>setMemberEval(m.id,'Không đạt')} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-semibold px-2.5 py-1 rounded-lg">Không đạt</button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1.5">🔒 Sổ ghi chú kín của BCN (Chỉ BCN nhìn thấy):</label>
                    <div className="flex gap-2">
                      <input
                        defaultValue={bcnNotes[m.id]||''}
                        onBlur={e=>saveMemberBcnNote(m.id,e.target.value)}
                        placeholder="VD: Cần hẹn gặp 1-1 trao đổi, dạo này bận thi chuyên ngành..."
                        className="form-input text-xs py-1.5 flex-1"
                      />
                      <button
                        onClick={e=>{
                          const inp=e.currentTarget.previousSibling;
                          saveMemberBcnNote(m.id,inp.value);
                        }}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        Lưu
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
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Khoản Chi Cần Duyệt & Chi Phí Lớn</h3>
            <span className="text-xs text-slate-400">Tổng chờ duyệt: <strong>{fmtVND(pendingExpenses.filter(e=>e.status==='Đã chi - Chờ hoàn tiền').reduce((s,e)=>s+(Number(e.amount)||0),0))}</strong></span>
          </div>

          {pendingExpenses.length===0?(
            <div className="card py-16 text-center">
              <span className="text-3xl block mb-2">💰</span>
              <p className="font-bold text-slate-700 dark:text-slate-200">Không có khoản chi nào chờ duyệt!</p>
              <p className="text-xs text-slate-400 mt-1">Tất cả chi tiêu của CLB đã được quyết toán hoàn tất.</p>
            </div>
          ):(
            <div className="space-y-3">
              {pendingExpenses.map(e=>(
                <div key={e.id} className="card p-4 border-l-4 border-amber-500 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base flex-shrink-0">
                      ₫
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">{e.name}</h4>
                        <span className={`status-badge text-[11px] ${expenseColor(e.status)}`}>{e.status}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Người chi: <strong>{e.person||'—'}</strong> · Ban: {e.ban||'Toàn CLB'} {e.note?`· "${e.note}"`:''}
                      </p>
                      <p className="text-base font-black text-orange-600 mt-1">{fmtVND(e.amount)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={()=>handleRejectExpense(e)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                      <Icon name="alert-circle" size={13}/>Yêu Cầu Giải Trình
                    </button>
                    <button onClick={()=>handleApproveExpense(e)} className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1">
                      <Icon name="check" size={14}/>Duyệt Quyết Toán
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
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Chiến Lược & Kế Hoạch Tác Chiến Kín</h3>
              <p className="text-xs text-slate-400">Các định hướng nhân sự, tài trợ và sự kiện chưa công bố</p>
            </div>
            <button onClick={openAddPlan} className="btn-primary text-xs flex items-center gap-1.5">
              <Icon name="plus" size={14}/>Tạo Kế Hoạch Mới
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {bcnPlans.map(p=>(
              <div key={p.id} className="card p-4 border-t-4 border-amber-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.level==='Tuyệt mật'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{p.level}</span>
                    {p.deadline&&<span className="text-xs text-slate-400">Mục tiêu: {fmtDate(p.deadline)}</span>}
                  </div>
                  <h4 className="font-bold text-base text-slate-800 dark:text-white mb-1.5">{p.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{p.content}</p>

                  <div className="space-y-1.5 mb-3 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Mốc Hành Động:</p>
                    {(p.milestones||[]).map(m=>(
                      <div key={m.id} onClick={()=>toggleMilestone(p.id,m.id)} className="flex items-center gap-2 cursor-pointer text-xs">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${m.done?'bg-emerald-500 text-white border-emerald-500':'border-slate-300'}`}>
                          {m.done?'✓':''}
                        </span>
                        <span className={m.done?'line-through text-slate-400':'text-slate-700 dark:text-slate-300'}>{m.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                  <span className="text-slate-400">Phụ trách: <strong>{p.pic||'BCN'}</strong></span>
                  <div className="flex gap-2">
                    <button onClick={()=>openEditPlan(p)} className="text-blue-500 hover:text-blue-700 font-medium">Sửa</button>
                    <button onClick={()=>handleDeletePlan(p.id)} className="text-red-400 hover:text-red-600 font-medium">Xóa</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={planModal} onClose={()=>setPlanModal(false)} title={editingPlan?'Sửa Kế Hoạch Tác Chiến':'Tạo Kế Hoạch Tác Chiến Mật Mới'}>
        <div className="space-y-3">
          <div><label className="form-label">Tên chiến lược / Dự án mật</label><input value={planForm.title} onChange={e=>setPlanForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="VD: Chiến dịch Tuyển CTV K81..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Cấp độ bảo mật</label><select value={planForm.level} onChange={e=>setPlanForm(p=>({...p,level:e.target.value}))} className="form-input"><option>Tuyệt mật</option><option>Nội bộ BCN</option><option>Ưu tiên cao</option></select></div>
            <div><label className="form-label">Thời hạn mục tiêu</label><input type="date" value={planForm.deadline} onChange={e=>setPlanForm(p=>({...p,deadline:e.target.value}))} className="form-input"/></div>
          </div>
          <div><label className="form-label">Người phụ trách chính (PIC)</label><input value={planForm.pic} onChange={e=>setPlanForm(p=>({...p,pic:e.target.value}))} className="form-input" placeholder="VD: Chủ nhiệm, Phó CN..."/></div>
          <div><label className="form-label">Nội dung chiến lược</label><textarea value={planForm.content} onChange={e=>setPlanForm(p=>({...p,content:e.target.value}))} className="form-input resize-none min-h-[70px]" placeholder="Mục tiêu, phương thức triển khai kín..."/></div>
          <div>
            <label className="form-label">Mốc hành động</label>
            <div className="flex gap-2 mb-2">
              <input value={newMilestone} onChange={e=>setNewMilestone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addMilestoneToForm())} className="form-input text-xs flex-1" placeholder="Thêm mốc công việc..."/>
              <button type="button" onClick={addMilestoneToForm} className="btn-secondary text-xs px-3">Thêm mốc</button>
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
            <button onClick={()=>setPlanModal(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSavePlan} className="btn-primary flex-1">Lưu Kế Hoạch</button>
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
    decisions.filter(d=>d.title.toLowerCase().includes(q)).slice(0,2).forEach(d=>r.push({label:d.title,sub:d.status,icon:'file-check-2',tab:'decisions',type:'Quyết định',tcolor:'text-amber-600',tbg:'bg-amber-50'}));
    events.filter(e=>e.name.toLowerCase().includes(q)).slice(0,2).forEach(e=>r.push({label:e.name,sub:fmtDate(e.date),icon:'calendar-days',tab:'events',type:'Sự kiện',tcolor:'text-blue-600',tbg:'bg-blue-50'}));
    (studyResources||[]).filter(s=>(s.title||'').toLowerCase().includes(q)||(s.note||'').toLowerCase().includes(q)).slice(0,3).forEach(s=>r.push({label:s.title,sub:`${s.category} • ${s.block}`,icon:'book-open',tab:'study',type:'Học tập',tcolor:'text-orange-600',tbg:'bg-orange-50'}));
    members.filter(m=>m.name.toLowerCase().includes(q)).slice(0,2).forEach(m=>r.push({label:m.name,sub:m.ban||m.role,icon:'user',tab:'members',type:'Thành viên',tcolor:'text-emerald-600',tbg:'bg-emerald-50'}));
    resources.filter(r2=>r2.title.toLowerCase().includes(q)).slice(0,2).forEach(r2=>r.push({label:r2.title,sub:r2.type,icon:'link',tab:'resources',type:'Tài nguyên',tcolor:'text-purple-600',tbg:'bg-purple-50'}));
    inventory.filter(i=>i.name.toLowerCase().includes(q)).slice(0,2).forEach(i=>r.push({label:i.name,sub:i.status,icon:'box',tab:'resources',type:'Vật dụng',tcolor:'text-teal-600',tbg:'bg-teal-50'}));
    return r.slice(0,9);
  },[query,decisions,events,members,resources,studyResources,inventory]);

  if(!open)return null;
  return(
    <div className="fixed inset-0 z-[200] bg-black/55 flex items-start justify-center pt-[10vh] px-4" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden cmd-in border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <Icon name="search" size={18} className="text-slate-400 flex-shrink-0"/>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm nhanh công việc, sự kiện, thành viên, tài liệu..." className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"/>
          <div className="flex items-center gap-1 flex-shrink-0">
            <kbd className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 rounded px-1.5 py-0.5">Ctrl K</kbd>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><Icon name="x" size={14} className="text-slate-400"/></button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {query&&results.length===0&&<p className="text-center text-sm text-slate-400 py-10">Không tìm thấy kết quả nào cho "<b>{query}</b>"</p>}
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
              <p className="text-sm text-slate-400 font-medium">Bắt đầu gõ để tìm kiếm toàn CLB</p>
              <p className="text-xs text-slate-300 mt-1">Tìm trong: Quyết định · Sự kiện · Thành viên · Tài nguyên · Vật dụng</p>
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
            <span className="font-bold text-slate-800 text-sm">Thông báo {unreadCount>0&&<span className="ml-1 bg-red-100 text-red-600 text-[11px] font-bold px-1.5 rounded-full">{unreadCount}</span>}</span>
            {unreadCount>0&&<button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Đọc tất cả</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.length===0?<div className="py-10 text-center text-slate-400 text-sm"><Icon name="bell-off" size={28} className="mx-auto mb-2 text-slate-200"/>Chưa có thông báo</div>:recent.map(n=>(
              <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition ${!n.read?'bg-blue-50/60':''}`}>
                <span className={`mt-0.5 flex-shrink-0 ${typeColors[n.type]||typeColors.info}`}><Icon name={typeIcons[n.type]||'info'} size={16}/></span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${!n.read?'font-semibold text-slate-800':'text-slate-600'}`}>{n.message}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{relTime(n.timestamp)}</p>
                </div>
                {!n.read&&<button onClick={()=>markRead(n.id)} className="flex-shrink-0 text-[11px] text-blue-500 hover:text-blue-700 font-medium">Đọc</button>}
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
  const pendingDecisions=decisions.filter(d=>d.status!=='Đã chốt chính thức');

  const nextEvent=events.filter(e=>e.date&&new Date(e.date)>=new Date(Date.now()-86400000)).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  const effectiveGTime=targetGTime||(nextEvent?`${nextEvent.date}T18:00`:'');
  const diffG=effectiveGTime?(new Date(effectiveGTime).getTime()-now):null;

  let gCountdownText='--:--:--';
  let isGPassed=false;
  if(diffG!==null){
    if(diffG<=0){
      isGPassed=true;
      gCountdownText='⚡ ĐÃ ĐẾN GIỜ G!';
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
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
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
      console.error('Lỗi thêm checklist:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const toggleCL=async(id)=>{
    const item=quickChecklist.find(i=>i.id===id);
    if(!item)return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const newDone=!item.done;
      if(newDone && !isInitialSnapshot)triggerCat('celebrate');
      await fbDb.collection('quickChecklist').doc(id).set({done:newDone},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi cập nhật checklist:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const resetCL=async()=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const batch=fbDb.batch();
      quickChecklist.forEach(i=>{
        batch.set(fbDb.collection('quickChecklist').doc(i.id),{done:false},{merge:true});
      });
      await batch.commit();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi reset checklist:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const delCL=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('quickChecklist').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa checklist:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const addLink=async()=>{
    if(!newLink.title.trim()||!newLink.url.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
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
      console.error('Lỗi thêm quick link:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const delLink=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('quickLinks').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa quick link:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const stats=[
    {label:'Việc đang chạy',value:activeTasks.length,icon:'list-todo',gradient:'from-blue-600 to-blue-800',onClick:()=>setActiveTab('events')},
    {label:'Việc quá hạn',value:overdueTasks.length,icon:'alarm-clock',gradient:'from-red-500 to-red-700',onClick:()=>setActiveTab('events')},
    {label:'Quyết định chờ chốt',value:pendingDecisions.length,icon:'file-question',gradient:'from-amber-500 to-orange-600',onClick:()=>setActiveTab('decisions')},
    {label:'Tổng thành viên/CTV',value:members.length,icon:'users',gradient:'from-emerald-500 to-teal-700',onClick:()=>setActiveTab('members')},
  ];

  return(
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Bảng Điều Khiển</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tổng quan hoạt động CLB NewVision HUP – ĐH Dược HN</p>
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
              <span className="font-bold text-sm text-slate-800">Checklist 15 Phút Trước Giờ G</span>
            </div>
            <div className="flex gap-1">
              {quickChecklist.some(i=>i.done)&&<button onClick={resetCL} title="Reset" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"><Icon name="rotate-ccw" size={13}/></button>}
              <button onClick={()=>setShowCLForm(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={13}/>Thêm</button>
            </div>
          </div>

          {/* ĐỒNG HỒ ĐẾM NGƯỢC GIỜ G THỜI GIAN THỰC */}
          <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 rounded-xl p-2.5 mb-3 border border-orange-200 dark:border-orange-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold text-orange-950 dark:text-orange-200">Đếm Ngược Giờ G:</span>
              <span className={`font-mono font-black text-sm tracking-wider ${isGPassed?'text-emerald-600 dark:text-emerald-400':'text-orange-600 dark:text-orange-400'}`}>
                {gCountdownText}
              </span>
            </div>
            <button
              onClick={()=>{setCustomGInput(effectiveGTime||'');setShowGTimeModal(true)}}
              className="text-[10px] text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-orange-200 dark:border-slate-700 shadow-sm flex-shrink-0"
              title="Cài đặt Giờ G"
            >
              <Icon name="clock" size={11}/>
              {effectiveGTime ? new Date(effectiveGTime).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : 'Chọn giờ'}
            </button>
          </div>
          {showCLForm&&(
            <div className="flex gap-2 mb-3">
              <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCLItem()} placeholder="Tên hạng mục..." className="form-input flex-1 text-sm" autoFocus/>
              <button onClick={addCLItem} className="btn-primary text-xs px-3">Thêm</button>
              <button onClick={()=>setShowCLForm(false)} className="btn-secondary text-xs px-2">Hủy</button>
            </div>
          )}
          {quickChecklist.length===0&&<div className="py-8 text-center"><Icon name="clipboard-list" size={32} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">Thêm các hạng mục kiểm tra nhanh</p></div>}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {quickChecklist.map(item=>(
              <div key={item.id} className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 group transition ${item.done?'opacity-60':''}`}>
                <input type="checkbox" checked={item.done} onChange={()=>toggleCL(item.id)} className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"/>
                <span className={`flex-1 text-sm ${item.done?'line-through text-slate-400':'text-slate-700'}`}>{item.text}</span>
                <button onClick={()=>delCL(item.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition"><Icon name="trash-2" size={13} className="text-red-400"/></button>
              </div>
            ))}
          </div>
          {quickChecklist.length>0&&<div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">{quickChecklist.filter(i=>i.done).length}/{quickChecklist.length} mục hoàn thành</div>}
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center"><Icon name="link" size={15} className="text-purple-600"/></div>
              <span className="font-bold text-sm text-slate-800">Link Nhanh Dùng Chung</span>
            </div>
            <button onClick={()=>setShowLinkForm(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={13}/>Thêm</button>
          </div>
          {showLinkForm&&(
            <div className="space-y-2 mb-3 p-3 bg-slate-50 rounded-xl">
              <input value={newLink.title} onChange={e=>setNewLink(p=>({...p,title:e.target.value}))} placeholder="Tên tài nguyên..." className="form-input text-sm"/>
              <input value={newLink.url} onChange={e=>setNewLink(p=>({...p,url:e.target.value}))} placeholder="https://..." className="form-input text-sm"/>
              <div className="flex gap-2"><button onClick={addLink} className="btn-primary text-xs px-3">Thêm</button><button onClick={()=>setShowLinkForm(false)} className="btn-secondary text-xs px-2">Hủy</button></div>
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
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2"><Icon name="activity" size={16} className="text-indigo-500"/>Tổng Quan Nhanh</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600 font-semibold mb-1">📅 Sự kiện sắp tới</p>
            {events.filter(e=>new Date(e.date)>=new Date()).slice(0,3).map(e=><p key={e.id} className="text-slate-700 text-xs truncate mt-1">· {e.name} — {fmtDate(e.date)}</p>)}
            {events.filter(e=>new Date(e.date)>=new Date()).length===0&&<p className="text-slate-400 text-xs">Chưa có sự kiện nào</p>}
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-amber-600 font-semibold mb-1">⚡ Cần duyệt</p>
            {decisions.filter(d=>d.status==='Cần duyệt').slice(0,3).map(d=><p key={d.id} className="text-slate-700 text-xs truncate mt-1">· {d.title}</p>)}
            {decisions.filter(d=>d.status==='Cần duyệt').length===0&&<p className="text-slate-400 text-xs">Không có</p>}
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-red-600 font-semibold mb-1">🔴 Quá hạn</p>
            {allTasks.filter(t=>!t.done&&isOverdue(t.deadline)).slice(0,3).map(t=><p key={t.id} className="text-slate-700 text-xs truncate mt-1">· {t.title}</p>)}
            {allTasks.filter(t=>!t.done&&isOverdue(t.deadline)).length===0&&<p className="text-slate-400 text-xs">Tốt, không có việc quá hạn!</p>}
          </div>
        </div>
      </div>

      {showGTimeModal&&(
        <Modal open={showGTimeModal} onClose={()=>setShowGTimeModal(false)} title="Cài Đặt Mốc Giờ G Sự Kiện">
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Thiết lập mốc thời gian diễn ra sự kiện (Giờ G) để đồng hồ đếm ngược trực tiếp:</p>
            <div>
              <label className="form-label">Chọn Ngày & Giờ G</label>
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
                📅 Lấy theo sự kiện gần nhất: {nextEvent.name} ({fmtDate(nextEvent.date)})
              </button>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={()=>{setTargetGTime('');setShowGTimeModal(false)}}
                className="btn-secondary flex-1 text-xs"
              >
                Mặc định theo sự kiện
              </button>
              <button
                onClick={()=>{if(customGInput)setTargetGTime(customGInput);setShowGTimeModal(false)}}
                className="btn-primary flex-1 text-xs"
              >
                Lưu Mốc Giờ G
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// DECISIONS PAGE – with Fast Poll / Biểu Quyết Nhanh
// ============================================================
function DecisionsPage(){
  const{decisions,setDecisions,addNotification,triggerMascot}=useContext(AppCtx);
  const[modal,setModal]=useState(false);
  const[editing,setEditing]=useState(null);
  const[filterBan,setFilterBan]=useState('');
  const[filterStatus,setFilterStatus]=useState('');
  const[confirmDel,setConfirmDel]=useState(null);
  const[pollInput,setPollInput]=useState({});
  const emptyForm={title:'',proposer:'',ban:'',pic:'',deadline:'',resolution:'',status:'Đang bàn bạc'};
  const[form,setForm]=useState(emptyForm);

  const openAdd=()=>{setEditing(null);setForm(emptyForm);setModal(true)};
  const openEdit=d=>{setEditing(d.id);setForm({...emptyForm,...d});setModal(true)};
  const handleClose=()=>{setModal(false);setEditing(null);setForm(emptyForm)};

  const handleSave=async()=>{
    if(!form.title.trim()){alert('Vui lòng nhập tên vấn đề!');return}
    if(form.status==='Đã chốt chính thức'&&!form.resolution.trim()){alert('Bắt buộc nhập phương án chốt!');return}
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      if(editing){
        const old=decisions.find(d=>d.id===editing);
        await fbDb.collection('decisions').doc(editing).set(form,{merge:true});
        try{playSound('success');}catch(e){}
        if(old&&old.status!=='Đã chốt chính thức'&&form.status==='Đã chốt chính thức'){
          try{addNotification(`✅ Vấn đề "${form.title}" đã chốt chính thức!`,'success');}catch(e){}
          triggerMascot('gavel','⚖️ Đã chốt chính thức!');
        }
      }else{
        const id=uid();
        const newD={...form,id,poll:{options:[],locked:false},createdAt:new Date().toISOString()};
        await fbDb.collection('decisions').doc(id).set(newD);
        try{playSound('success');}catch(e){}
        if(form.status==='Đã chốt chính thức'){
          try{addNotification(`✅ Vấn đề "${form.title}" đã chốt!`,'success');}catch(e){}
          triggerMascot('gavel','⚖️ Đã chốt!');
        }else{
          triggerMascot('write','📝 Vấn đề mới ghi nhận!');
        }
      }
      handleClose();
    }catch(err){
      console.error('Lỗi lưu quyết định:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const handleStatusChange=async(d,ns)=>{
    if(ns==='Đã chốt chính thức'&&!d.resolution){openEdit({...d,status:ns});return}
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('decisions').doc(d.id).set({status:ns},{merge:true});
      try{playSound('pop');}catch(e){}
      if(ns==='Đã chốt chính thức'){
        try{addNotification(`✅ "${d.title}" đã chốt!`,'success');}catch(e){}
        triggerMascot('gavel','⚖️ Đã chốt chính thức!');
      }
    }catch(err){
      console.error('Lỗi đổi trạng thái:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const addPollOption=async(dId)=>{
    const txt=(pollInput[dId]||'').trim();
    if(!txt)return;
    const d=decisions.find(x=>x.id===dId);
    if(!d)return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const poll=d.poll||{options:[],locked:false};
      const updatedPoll={...poll,options:[...poll.options,{id:uid(),text:txt,votes:0}]};
      await fbDb.collection('decisions').doc(dId).set({poll:updatedPoll},{merge:true});
      setPollInput(p=>({...p,[dId]:''}));
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi thêm phương án:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const vote=async(dId,optId)=>{
    const d=decisions.find(x=>x.id===dId);
    if(!d||(d.poll&&d.poll.locked))return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const poll=d.poll||{options:[],locked:false};
      const updatedPoll={...poll,options:poll.options.map(o=>o.id===optId?{...o,votes:(o.votes||0)+1}:o)};
      await fbDb.collection('decisions').doc(dId).set({poll:updatedPoll},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi bỏ phiếu:',err);
      alert('Lỗi lưu Firebase: '+err.message);
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
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const poll=d.poll||{options:[],locked:false};
      const updatedPoll={...poll,options:poll.options.filter(o=>o.id!==optId)};
      await fbDb.collection('decisions').doc(dId).set({poll:updatedPoll},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa phương án:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const handleDeleteDecision=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('decisions').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('Đã xóa vấn đề','info');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa quyết định:',err);
      alert('Lỗi lưu Firebase: '+err.message);
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
            <Icon name="bar-chart-2" size={13}/>Biểu Quyết Nhanh
            {poll.locked&&<span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full">🔒 Đã khóa</span>}
          </p>
          {!poll.locked&&maxVotes>0&&poll.options.length>1&&(
            <button onClick={()=>lockPoll(d.id)} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2.5 py-1 font-semibold">Chốt phương án thắng</button>
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
                    <span className={`font-medium ${isLeading?'text-indigo-700':'text-slate-700'}`}>{isLeading&&total>0?'🏆 ':''}{opt.text}</span>
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
          {poll.options.length===0&&<p className="text-xs text-indigo-400 text-center py-3">Chưa có phương án. Thêm để bắt đầu biểu quyết!</p>}
        </div>
        {!poll.locked&&d.status!=='Đã chốt chính thức'&&(
          <div className="flex gap-2">
            <input value={pollInput[d.id]||''} onChange={e=>setPollInput(p=>({...p,[d.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addPollOption(d.id)} placeholder="Nhập tên phương án..." className="flex-1 text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:border-indigo-400"/>
            <button onClick={()=>addPollOption(d.id)} className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg px-3 font-semibold">Thêm</button>
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Sổ Quyết Định & Biểu Quyết</h1><p className="text-xs text-slate-500 mt-0.5">Theo dõi, biểu quyết nhanh và chốt phương án chính thức</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="plus" size={15}/>Thêm mới</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={filterBan} onChange={e=>setFilterBan(e.target.value)} className="form-input text-sm w-auto">
          <option value="">Tất cả ban</option>
          {BANS.map(b=><option key={b}>{b}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="form-input text-sm w-auto">
          <option value="">Tất cả trạng thái</option>
          {DECISION_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        {(filterBan||filterStatus)&&<button onClick={()=>{setFilterBan('');setFilterStatus('')}} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"><Icon name="x-circle" size={13}/>Xóa lọc</button>}
      </div>
      {filtered.length===0&&<div className="card py-16 text-center"><Icon name="file-text" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">Chưa có vấn đề nào được ghi nhận</p></div>}
      <div className="space-y-3">
        {filtered.map(d=>{
          const over=d.status!=='Đã chốt chính thức'&&isOverdue(d.deadline);
          return(
            <div key={d.id} className={`card p-4 fade-in ${over?'overdue':''}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`status-badge ${statusColor(d.status)}`}>{d.status}</span>
                    {d.ban&&<span className="status-badge tag-gray text-xs">{d.ban}</span>}
                    {over&&<span className="status-badge tag-red text-xs">⚠ Quá hạn</span>}
                  </div>
                  <h3 className="font-bold text-slate-800 mt-1">{d.title}</h3>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    {d.proposer&&<span className="flex items-center gap-1"><Icon name="user" size={11}/>Đề xuất: <b className="text-slate-700">{d.proposer}</b></span>}
                    {d.pic&&<span className="flex items-center gap-1"><Icon name="user-check" size={11}/>PIC: <b className="text-slate-700">{d.pic}</b></span>}
                    {d.deadline&&<span className="flex items-center gap-1"><Icon name="calendar" size={11}/>Hạn: <b className={over?'text-red-600':'text-slate-700'}>{fmtDate(d.deadline)}</b></span>}
                  </div>
                  {d.resolution&&<div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800"><b>✅ Phương án chốt:</b> {d.resolution}</div>}
                  {d.status!=='Đã chốt chính thức'&&<PollSection d={d}/>}
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
      <Modal open={modal} onClose={handleClose} title={editing?'Chỉnh sửa vấn đề':'Ghi nhận vấn đề mới'}>
        <div className="space-y-4">
          <div><label className="form-label">Vấn đề / Đề xuất <span className="text-red-500">*</span></label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="Mô tả ngắn gọn vấn đề hoặc đề xuất..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Người đề xuất</label><input value={form.proposer} onChange={e=>setForm(p=>({...p,proposer:e.target.value}))} className="form-input" placeholder="Tên người đề xuất"/></div>
            <div><label className="form-label">Ban liên quan</label><select value={form.ban} onChange={e=>setForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chọn ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">PIC – Người chịu trách nhiệm</label><input value={form.pic} onChange={e=>setForm(p=>({...p,pic:e.target.value}))} className="form-input" placeholder="Tên người phụ trách"/></div>
            <div><label className="form-label">Hạn phản hồi</label><input type="date" value={form.deadline} onChange={e=>setForm(p=>({...p,deadline:e.target.value}))} className="form-input"/></div>
          </div>
          <div><label className="form-label">Trạng thái</label><select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} className="form-input">{DECISION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="form-label">Phương án chốt cuối cùng {form.status==='Đã chốt chính thức'&&<span className="text-red-500">*</span>}</label><textarea value={form.resolution} onChange={e=>setForm(p=>({...p,resolution:e.target.value}))} className="form-input min-h-[80px] resize-none" placeholder={form.status==='Đã chốt chính thức'?'Bắt buộc – ghi rõ phương án...':'Ghi lại phương án đã thống nhất...'}/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Hủy</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'Lưu thay đổi':'Ghi nhận'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>handleDeleteDecision(confirmDel)} message="Bạn có chắc muốn xóa vấn đề này?"/>
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
      alert(`Đầu việc này do ${task.assignee} đảm nhận!`);
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
        title={isAssignedToOther ? `Đầu việc này do ${task.assignee} đảm nhận` : ''}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.done?'line-through text-slate-400':'text-slate-800'}`}>{task.title}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {task.assignee&&<span className="text-xs text-slate-500 flex items-center gap-0.5"><Icon name="user" size={11}/>{task.assignee}</span>}
          {task.ban&&<span className="status-badge tag-gray text-[11px]">{task.ban}</span>}
          {task.deadline&&<span className={`status-badge text-[11px] ${over?'tag-red':soon?'tag-yellow':'tag-gray'}`}><Icon name="clock" size={10}/>&nbsp;{fmtDate(task.deadline)}{over?' ⚠':soon?' ⏰':''}</span>}
          {task.link&&<a href={task.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"><Icon name="link" size={10}/>Link</a>}
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        {canEdit && <button onClick={()=>onEdit(task)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Chỉnh sửa"><Icon name="pencil" size={13} className="text-slate-400"/></button>}
        {canDelete && <button onClick={()=>onDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Xóa"><Icon name="trash-2" size={13} className="text-red-400"/></button>}
      </div>
    </div>
  );
}

// ============================================================
// LIVE EVENT MODE – Chế độ Thực Địa
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
    try{addNotification(`🚨 SOS tại "${event.name}": ${sosText.slice(0,60)}`,'error');}catch(e){}
    triggerMascot('sos','🚨 SOS! Đang xử lý sự cố!');
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
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">⚡ LIVE EVENT MODE</span>
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
            <p className="text-red-300 font-bold text-sm mb-2 flex items-center gap-2"><Icon name="alert-octagon" size={16} className="text-red-400"/>🚨 {openInc.length} SỰ CỐ ĐANG MỞ</p>
            {openInc.map(i=>(
              <div key={i.id} className="flex items-center gap-2 bg-red-950/40 rounded-xl p-2.5 mb-1">
                <p className="flex-1 text-red-200 text-sm font-semibold">{i.desc}</p>
                <span className="text-red-400 text-xs flex-shrink-0">{i.time}</span>
                <button onClick={()=>resolveInc(i.id)} className="flex-shrink-0 text-xs bg-emerald-700 text-white rounded-lg px-2 py-1 hover:bg-emerald-600">✓</button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl p-4" style={{background:'#1e293b',border:'1px solid #334155'}}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white flex items-center gap-2"><Icon name="clipboard-check" size={16} className="text-indigo-400"/>Check-in Hạng Mục</h2>
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
            <Icon name="git-branch" size={16} className="text-indigo-400"/>Timeline Công Việc
            {tasks.filter(t=>!t.done).length>0&&<span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">{tasks.filter(t=>!t.done).length} chờ xử lý</span>}
          </h2>
          {tasks.length===0?<p className="text-slate-500 text-sm text-center py-4">Chưa có đầu việc nào</p>:(
            <div className="space-y-2.5">
              {[...tasks].reverse().map(t=>(
                <div key={t.id} className={`flex items-start gap-3 pl-4 border-l-2 ${t.done?'border-emerald-600':'border-indigo-600'}`}>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 -ml-5 mt-1 border-2 ${t.done?'bg-emerald-500 border-emerald-500':'bg-slate-800 border-indigo-500'}`}/>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${t.done?'line-through text-slate-500':'text-white'}`}>{t.title}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs" style={{color:'#94a3b8'}}>
                      {t.assignee&&<span>👤 {t.assignee}</span>}
                      {t.deadline&&<span>⏰ {new Date(t.deadline).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span>}
                      <span style={{color:t.phase===TASK_PHASES[0]?'#818cf8':'#34d399'}}>{t.phase}</span>
                    </div>
                  </div>
                  <div className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${t.done?'bg-emerald-900 text-emerald-300':'bg-indigo-900 text-indigo-300'}`}>{t.done?'✓ Xong':'Đang làm'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {(ld.incidents||[]).filter(i=>i.resolved).length>0&&(
          <div className="rounded-2xl p-4" style={{background:'#1e293b',border:'1px solid #334155'}}>
            <h2 className="font-bold text-slate-400 flex items-center gap-2 mb-3 text-sm"><Icon name="check-circle" size={14}/>Sự Cố Đã Xử Lý</h2>
            {(ld.incidents||[]).filter(i=>i.resolved).map(i=>(
              <div key={i.id} className="flex items-center gap-2 py-1.5 text-slate-500 text-sm">
                <span>✅</span><span className="line-through flex-1">{i.desc}</span><span className="text-xs">{i.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {sosModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)'}}>
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{background:'#1a0000',border:'2px solid #7f1d1d'}}>
            <div className="text-center mb-4">
              <p className="text-5xl mb-2">🚨</p>
              <h3 className="text-xl font-bold text-red-300">Báo Sự Cố Khẩn Cấp</h3>
              <p className="text-red-400/80 text-sm mt-1">Mô tả nhanh sự cố đang xảy ra tại hiện trường</p>
            </div>
            <textarea value={sosText} onChange={e=>setSosText(e.target.value)} className="w-full rounded-xl p-3 text-white text-sm resize-none min-h-[90px] outline-none" style={{background:'rgba(239,68,68,0.1)',border:'1px solid #7f1d1d'}} placeholder="VD: Mất nguồn loa hệ thống... / Thiếu 20 ghế khu A..."/>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>{setSosModal(false);setSosText('')}} className="flex-1 py-2.5 rounded-xl font-medium text-sm" style={{border:'1px solid #7f1d1d',color:'#fca5a5'}}>Hủy</button>
              <button onClick={addSOS} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{background:'#dc2626'}}>🚨 Gửi Báo Cáo SOS</button>
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
    if(!taskForm.title.trim()){alert('Vui lòng nhập tên công việc!');return}
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
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      let updatedTasks;
      let savedTask;
      if(editingTask){
        savedTask={...taskForm,id:editingTask};
        updatedTasks=(curEvent.tasks||[]).map(t=>t.id===editingTask?{...t,...taskForm}:t);
      }else{
        savedTask={...taskForm,id:uid(),createdAt:new Date().toISOString()};
        updatedTasks=[...(curEvent.tasks||[]),savedTask];
        if(taskForm.assignee.trim()){
          try{addNotification(`📋 Đã giao việc "${taskForm.title}" cho ${taskForm.assignee}`,'info');}catch(e){}
          triggerMascot('write',`📋 Giao cho ${taskForm.assignee}!`);
        }else{
          triggerMascot('write','📝 Đầu việc mới!');
        }
      }
      // Ghi cập nhật trực tiếp vào document của Sự kiện trên Firestore
      await fbDb.collection('events').doc(curEvent.id).set({tasks:updatedTasks},{merge:true});
      // Đồng thời cập nhật hoặc thêm vào collection tasks độc lập
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
      console.error('Lỗi lưu công việc sự kiện:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const toggleTask=async(taskId)=>{
    const task=(curEvent.tasks||[]).find(t=>t.id===taskId);
    if(!task)return;
    const newDone=!task.done;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const updatedTasks=(curEvent.tasks||[]).map(t=>t.id===taskId?{...t,done:newDone}:t);
      await fbDb.collection('events').doc(curEvent.id).set({tasks:updatedTasks},{merge:true});
      try{
        await fbDb.collection('tasks').doc(taskId).set({done:newDone},{merge:true});
      }catch(e){}
      try{
        try{playSound('pop');}catch(e){}
      }catch(e){}
      if(newDone){
        try{addNotification(`✅ Hoàn thành: "${task.title}"`,'success');}catch(e){}
        if(!isInitialSnapshot)triggerMascot('celebrate','🎉 Xuất sắc!');
      }else{
        try{addNotification(`🔄 Mở lại: "${task.title}"`,'warning');}catch(e){}
      }
    }catch(err){
      console.error('Lỗi đổi trạng thái công việc:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const deleteTask=async(taskId)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const updatedTasks=(curEvent.tasks||[]).filter(t=>t.id!==taskId);
      await fbDb.collection('events').doc(curEvent.id).set({tasks:updatedTasks},{merge:true});
      try{
        await fbDb.collection('tasks').doc(taskId).delete();
      }catch(e){}
      try{
        try{playSound('pop');}catch(e){}
      }catch(e){}
    }catch(err){
      console.error('Lỗi xóa công việc:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const updateLiveData=async(updEv)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('events').doc(updEv.id).set(updEv,{merge:true});
    }catch(err){
      console.error('Lỗi lưu Live Event:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const tasksByPhase=phase=>(curEvent.tasks||[]).filter(t=>{
    if(t.phase!==phase)return false;
    if(myTasksOnly){
      if(!t.assignee||!userIdentity||!t.assignee.toLowerCase().includes(userIdentity.toLowerCase()))return false;
    }
    if(!taskBanFilter)return true;
    const b=(t.ban||'').toLowerCase();
    if(taskBanFilter==='Nội vụ')return b.includes('nội vụ');
    if(taskBanFilter==='Truyền thông')return b.includes('truyền thông');
    if(taskBanFilter==='Sự kiện')return b.includes('sự kiện');
    if(taskBanFilter==='Đối ngoại')return b.includes('đối ngoại');
    if(taskBanFilter==='Toàn CLB')return b.includes('toàn clb');
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
          <Icon name="zap" size={15}/>⚡ Thực Địa
        </button>
      </div>

      {totalTasks>0&&(
        <div className="card p-3">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>Tiến độ công việc</span>
            <span className="font-bold">{doneTasks}/{totalTasks} ({progress}%)</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-2.5 rounded-full transition-all duration-700 ${progress===100?'bg-emerald-500':'bg-indigo-500'}`} style={{width:`${progress}%`}}/>
          </div>
          {progress===100&&<p className="text-xs text-emerald-600 font-semibold mt-1.5 text-center">🎉 Hoàn thành 100%!</p>}
        </div>
      )}

      {curEvent.note&&<div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800"><Icon name="sticky-note" size={14} className="inline mr-1.5"/>Ghi chú: {curEvent.note}</div>}

      {/* BỘ LỌC BAN & VIỆC CỦA TÔI */}
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
            <span>⚡</span> Việc của tôi {userIdentity ? `(${userIdentity})` : ''}
          </button>

          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0 ml-1 mr-1">
            <Icon name="filter" size={12}/> Ban:
          </span>
          {['', 'Nội vụ', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Toàn CLB'].map(b => (
            <button
              key={b}
              onClick={() => setTaskBanFilter(b)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                taskBanFilter === b
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {b || 'Tất cả ban'}
            </button>
          ))}
        </div>
        {(taskBanFilter || myTasksOnly) && (
          <button
            onClick={() => { setTaskBanFilter(''); setMyTasksOnly(false); }}
            className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 flex-shrink-0"
          >
            <Icon name="x-circle" size={12}/>Xóa lọc
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
              <button onClick={()=>openAddTask(phase)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={13}/>Thêm việc</button>
            </div>
            <div className="space-y-2">
              {phaseTasks.length===0&&<p className="text-xs text-slate-400 py-3 text-center">Chưa có đầu việc nào trong giai đoạn này</p>}
              {pendingTasks.map(t=><TaskRow key={t.id} task={t} onToggle={toggleTask} onEdit={openEditTask} onDelete={id=>setConfirmDel(id)}/>)}

              {completedTasks.length > 0 && (
                <details className="mt-3 pt-2 border-t border-slate-100">
                  <summary className="text-xs font-semibold text-slate-500 cursor-pointer py-1 select-none hover:text-slate-700 flex items-center gap-1">
                    <span>✅ Đã xong ({completedTasks.length})</span>
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

      <Modal open={taskModal} onClose={handleTaskClose} title={editingTask?'Chỉnh sửa công việc':'Thêm đầu việc mới'}>
        <div className="space-y-4">
          <div><label className="form-label">Tên công việc <span className="text-red-500">*</span></label><input value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))} className="form-input" placeholder="Tên công việc cần làm..."/></div>
          <div><label className="form-label">Giai đoạn</label><select value={taskForm.phase} onChange={e=>setTaskForm(p=>({...p,phase:e.target.value}))} className="form-input">{TASK_PHASES.map(ph=><option key={ph}>{ph}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Người phụ trách</label>
              <select
                value={taskForm.assignee}
                onChange={e=>setTaskForm(p=>({...p,assignee:e.target.value}))}
                className="form-input"
              >
                <option value="">-- Chọn thành viên --</option>
                {members.map(m=>(
                  <option key={m.id} value={m.name}>{m.name} ({m.ban || m.role || 'Thành viên'})</option>
                ))}
              </select>
            </div>
            <div><label className="form-label">Ban phối hợp</label><select value={taskForm.ban} onChange={e=>setTaskForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chọn ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
          </div>
          <div><label className="form-label">Deadline</label><input type="datetime-local" value={taskForm.deadline} onChange={e=>setTaskForm(p=>({...p,deadline:e.target.value}))} className="form-input"/></div>
          <div><label className="form-label">Link tài liệu đính kèm</label><input value={taskForm.link} onChange={e=>setTaskForm(p=>({...p,link:e.target.value}))} className="form-input" placeholder="https://drive.google.com/..."/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleTaskClose} className="btn-secondary flex-1">Hủy</button><button onClick={handleTaskSave} className="btn-primary flex-1">{editingTask?'Lưu thay đổi':'Thêm việc'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>deleteTask(confirmDel)} message="Xóa đầu việc này?"/>
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
    if(!form.name.trim()){alert('Vui lòng nhập tên sự kiện!');return}
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      if(editing){
        await fbDb.collection('events').doc(editing).set(form,{merge:true});
        try{playSound('success');}catch(e){}
        try{addNotification(`Đã cập nhật sự kiện: ${form.name}`,'success');}catch(e){}
      }else{
        const id=uid();
        const newEv={...form,id,tasks:[],createdAt:new Date().toISOString()};
        await fbDb.collection('events').doc(id).set(newEv);
        try{playSound('success');}catch(e){}
        try{addNotification(`Đã tạo sự kiện mới: ${form.name}`,'success');}catch(e){}
      }
      handleClose();
    }catch(err){
      console.error('Lỗi lưu sự kiện:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const handleDeleteEvent=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('events').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('Đã xóa sự kiện','info');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa sự kiện:',err);
      alert('Lỗi lưu Firebase: '+err.message);
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
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{tasks.length} việc</span>
              {done>0&&<span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">✓ {done} xong</span>}
              {over>0&&<span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">⚠ {over} quá hạn</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={ev2=>ev2.stopPropagation()}>
            <button onClick={ev2=>openEdit(ev2,e)} className="p-2 rounded-lg hover:bg-slate-100" title="Sửa sự kiện"><Icon name="pencil" size={14} className="text-slate-400"/></button>
            {adminMode && <button onClick={()=>setConfirmDel(e.id)} className="p-2 rounded-lg hover:bg-red-50" title="Xóa sự kiện"><Icon name="trash-2" size={14} className="text-red-400"/></button>}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Điều Phối Sự Kiện & Giao Việc</h1><p className="text-xs text-slate-500 mt-0.5">Quản lý sự kiện, đầu việc và chế độ thực địa</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="plus" size={15}/>Tạo sự kiện</button>
      </div>
      {events.length===0&&<div className="card py-16 text-center"><Icon name="calendar-plus" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">Chưa có sự kiện nào</p></div>}
      {upcoming.length>0&&<div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sắp tới & Đang diễn ra</p><div className="space-y-3">{upcoming.map(e=><EventCard key={e.id} e={e}/>)}</div></div>}
      {past.length>0&&<div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Đã qua</p><div className="space-y-3 opacity-70">{past.map(e=><EventCard key={e.id} e={e}/>)}</div></div>}
      <Modal open={modal} onClose={handleClose} title={editing?'Chỉnh sửa sự kiện':'Tạo sự kiện mới'}>
        <div className="space-y-4">
          <div><label className="form-label">Tên sự kiện <span className="text-red-500">*</span></label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-input" placeholder="Tên sự kiện..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Ngày tổ chức</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="form-input"/></div>
            <div><label className="form-label">Địa điểm</label><input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} className="form-input" placeholder="Giảng đường, phòng họp..."/></div>
          </div>
          <div><label className="form-label">Ghi chú</label><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} className="form-input resize-none min-h-[72px]" placeholder="Ghi chú thêm..."/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Hủy</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'Lưu thay đổi':'Tạo sự kiện'}</button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>handleDeleteEvent(confirmDel)} message="Xóa sự kiện và toàn bộ công việc bên trong?"/>
    </div>
  );
}

// ============================================================
// MEMBER PROFILE MODAL – Talent Hub
// ============================================================
function MemberProfileModal({member,open,onClose,sessions,assignTasks,events}){
  const totalSessions=sessions.length;
  const presentCount=sessions.filter(s=>member.attendance?.[s.id]==='Có mặt').length;
  const attendancePct=totalSessions>0?Math.round(presentCount/totalSessions*100):null;
  const trackedTasks=assignTasks.filter(t=>member.taskStatus?.[t.id]);
  const onTimeCount=trackedTasks.filter(t=>member.taskStatus?.[t.id]==='Đúng hạn').length;
  const taskPct=trackedTasks.length>0?Math.round(onTimeCount/trackedTasks.length*100):null;
  const assignedEventTasks=events.flatMap(e=>(e.tasks||[]).filter(t=>t.assignee&&t.assignee.toLowerCase().includes(member.name.toLowerCase())).map(t=>({...t,eventName:e.name})));
  const doneEventTasks=assignedEventTasks.filter(t=>t.done).length;
  const skills=member.skills||[];

  const kpcfg=(pct)=>pct===null?{c1:'#94a3b8',c2:'#64748b'}:pct>=80?{c1:'#059669',c2:'#0f766e'}:pct>=60?{c1:'#d97706',c2:'#c2410c'}:{c1:'#dc2626',c2:'#991b1b'};

  return(
    <Modal open={open} onClose={onClose} title="Hồ Sơ Năng Lực Thành Viên" wide>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-lg">{member.name.charAt(0).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-slate-800">{member.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className={`status-badge text-xs ${member.role==='Ban Chủ Nhiệm'?'tag-blue':member.role==='CTV'?'tag-gray':'tag-green'}`}>{member.role}</span>
              {member.ban&&<span className="status-badge tag-gray text-xs">{member.ban}</span>}
              {member.khoa&&<span className="status-badge tag-purple text-xs">{member.khoa}</span>}
              {member.lopHup&&<span className="status-badge tag-blue text-xs">{member.lopHup}</span>}
              <span className={`status-badge text-xs ${evalColor(member.eval||'Đạt')}`}>{member.eval||'Đạt'}</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
              {member.phone&&<span>📞 {member.phone}</span>}
              {member.email&&<span>✉️ {member.email}</span>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">📊 Chỉ số tự động (KPI)</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:'% Đi họp',val:attendancePct!==null?`${attendancePct}%`:'—',sub:`${presentCount}/${totalSessions} buổi`,...kpcfg(attendancePct)},
              {label:'% Đúng hạn',val:taskPct!==null?`${taskPct}%`:'—',sub:`${onTimeCount}/${trackedTasks.length} bài tập`,...kpcfg(taskPct)},
              {label:'Việc sự kiện',val:assignedEventTasks.length,sub:`✓ ${doneEventTasks} hoàn thành`,c1:'#4f46e5',c2:'#7c3aed'},
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
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">🎯 Thế mạnh chuyên môn</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map(s=><span key={s} className="status-badge tag-purple text-xs">{s}</span>)}
            </div>
          </div>
        )}

        {assignedEventTasks.length>0&&(
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">📋 Công việc sự kiện đã/đang phụ trách</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {assignedEventTasks.map(t=>(
                <div key={t.id} className={`flex items-center gap-2.5 p-2 rounded-lg ${t.done?'bg-emerald-50':'bg-blue-50'}`}>
                  <span className="flex-shrink-0">{t.done?'✅':'🔵'}</span>
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
            <p className="text-xs font-bold text-amber-600 mb-1">💬 Nhận xét thái độ</p>
            <p className="text-sm text-amber-800 italic">"{member.note}"</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={()=>{
            const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Thẻ Đánh Giá - ${member.name}</title>
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
      <h3 style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#6366f1">CLB Kỹ Năng Mềm NewVision – ĐH Dược HN</h3>
      <h1 style="margin:4px 0 0;font-size:24px;font-weight:900;color:#0f172a">${member.name}</h1>
    </div>
    <span class="badge" style="font-size:14px;padding:4px 12px;background:#dcfce7;color:#15803d">${member.eval||'Đạt'}</span>
  </div>
  <div style="font-size:13px;color:#64748b;margin-bottom:12px">
    <span>${member.role}</span> · <span>${member.ban||'Toàn CLB'}</span> · <span>${member.khoa||''}</span>
    ${member.phone?` · 📞 ${member.phone}`:''}
  </div>
  <div class="kpi-row">
    <div class="kpi-box"><div style="font-size:11px;color:#64748b">% Đi Họp</div><div class="kpi-val">${attendancePct!==null?attendancePct+'%':'—'}</div><div style="font-size:10px;color:#94a3b8">${presentCount}/${totalSessions} buổi</div></div>
    <div class="kpi-box"><div style="font-size:11px;color:#64748b">% Đúng Hạn</div><div class="kpi-val">${taskPct!==null?taskPct+'%':'—'}</div><div style="font-size:10px;color:#94a3b8">${onTimeCount}/${trackedTasks.length} bài</div></div>
    <div class="kpi-box"><div style="font-size:11px;color:#64748b">Việc Sự Kiện</div><div class="kpi-val">${assignedEventTasks.length}</div><div style="font-size:10px;color:#94a3b8">${doneEventTasks} hoàn thành</div></div>
  </div>
  ${skills.length>0?`<div style="margin-top:14px"><strong style="font-size:12px;color:#475569">Thế mạnh chuyên môn:</strong><div style="margin-top:6px">${skills.map(s=>`<span class="tag">${s}</span>`).join('')}</div></div>`:''}
  ${member.note?`<div class="note"><strong>Nhận xét thái độ:</strong> "${member.note}"</div>`:''}
  <div style="margin-top:20px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">
    <span>NewVision HUP Talent Profile</span>
    <span>Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</span>
  </div>
</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
            const w=window.open('','_blank');
            if(w){w.document.write(html);w.document.close()}
          }} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
            <Icon name="printer" size={14}/>Xuất Thẻ Đánh Giá Cá Nhân
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
  const emptyForm={name:'',role:'Thành viên chính thức',ban:'',gen:'',lopHup:'',khoa:'',phone:'',email:'',note:'',eval:'Đạt',skills:[],attendance:{},taskStatus:{}};
  const[form,setForm]=useState(emptyForm);

  const openAdd=()=>{setEditing(null);setForm(emptyForm);setModal(true)};
  const openEdit=m=>{setEditing(m.id);setForm({...emptyForm,...m,gen:m.gen||m.khoa||'',lopHup:m.lopHup||'',skills:m.skills||[]});setModal(true)};
  const handleClose=()=>{setModal(false);setEditing(null)};

  const handleSave=async()=>{
    if(!form.name.trim()){alert('Vui lòng nhập họ tên!');return}
    const finalKhoa=form.gen?(form.lopHup?`${form.gen} · ${form.lopHup}`:form.gen):(form.lopHup||form.khoa||'');
    const memberData={...form,khoa:finalKhoa};
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      if(editing){
        await fbDb.collection('members').doc(editing).set(memberData,{merge:true});
        try{playSound('success');}catch(e){}
        try{addNotification(`Đã cập nhật thông tin: ${form.name}`,'success');}catch(e){}
      }else{
        // Kiểm tra xem thành viên này đã tồn tại chưa để tránh tạo trùng lặp
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
        try{addNotification(`Đã thêm thành viên mới: ${form.name}`,'success');}catch(e){}
      }
      handleClose();
    }catch(err){
      console.error('Lỗi lưu thành viên:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const toggleSkill=skill=>{
    const cur=form.skills||[];
    setForm(p=>({...p,skills:cur.includes(skill)?cur.filter(s=>s!==skill):[...cur,skill]}));
  };

  const setAttend=async(mId,sId,val)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const m=members.find(x=>x.id===mId);
      const curAtt=m?.attendance||{};
      await fbDb.collection('members').doc(mId).set({attendance:{...curAtt,[sId]:val}},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi lưu điểm danh:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const setTaskStat=async(mId,tId,val)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const m=members.find(x=>x.id===mId);
      const curStat=m?.taskStatus||{};
      await fbDb.collection('members').doc(mId).set({taskStatus:{...curStat,[tId]:val}},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi lưu bài tập:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const setNote=async(mId,note)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('members').doc(mId).set({note},{merge:true});
    }catch(err){
      console.error('Lỗi lưu ghi chú:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const setEval=async(mId,val)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('members').doc(mId).set({eval:val},{merge:true});
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi lưu đánh giá:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const addSession=async()=>{
    if(!newSession.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const id=uid();
      await fbDb.collection('sessions').doc(id).set({id,name:newSession.trim(),createdAt:new Date().toISOString()});
      setNewSession('');
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi thêm buổi sinh hoạt:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const deleteSession=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('sessions').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa buổi sinh hoạt:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const addATask=async()=>{
    if(!newATask.trim())return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const id=uid();
      await fbDb.collection('assignTasks').doc(id).set({id,name:newATask.trim(),createdAt:new Date().toISOString()});
      setNewATask('');
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi thêm nhiệm vụ:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const deleteATask=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('assignTasks').doc(id).delete();
      try{playSound('pop');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa nhiệm vụ:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };
  const handleDeleteMember=async(id)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('members').doc(id).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('Đã xóa thành viên','info');}catch(e){}
    }catch(err){
      console.error('Lỗi xóa thành viên:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  // Khử trùng lặp thành viên trước khi duyệt mảng để render giao diện
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

  const bans=[...new Set(uniqueMembers.map(m=>m.ban||'Chưa phân ban'))];
  let filteredMembers=uniqueMembers;
  if(selectedBan)filteredMembers=filteredMembers.filter(m=>(m.ban||'Chưa phân ban')===selectedBan);
  if(searchKhoaLop.trim()){
    const q=searchKhoaLop.trim().toLowerCase();
    filteredMembers=filteredMembers.filter(m=>
      (m.gen&&m.gen.toLowerCase().includes(q))||
      (m.lopHup&&m.lopHup.toLowerCase().includes(q))||
      (m.khoa&&m.khoa.toLowerCase().includes(q))||
      (m.name&&m.name.toLowerCase().includes(q))
    );
  }
  const groupedByBan=bans.reduce((acc,b)=>({...acc,[b]:filteredMembers.filter(m=>(m.ban||'Chưa phân ban')===b)}),{});

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Thành Viên & CTV NewVision HUP</h1><p className="text-xs text-slate-500 mt-0.5">Hồ sơ năng lực, chấm công và đánh giá tổng kết</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5"><Icon name="user-plus" size={15}/>Thêm mới</button>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['members','Danh sách'],['attendance','Chấm công'],['tasks','Bài tập']].map(([v,l])=>(
          <button key={v} onClick={()=>setViewMode(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode===v?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={selectedBan} onChange={e=>setSelectedBan(e.target.value)} className="form-input text-sm w-auto">
          <option value="">Tất cả ban</option>
          {bans.map(b=><option key={b}>{b}</option>)}
        </select>
        <div className="relative flex-1 min-w-[210px] max-w-xs">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            type="text"
            value={searchKhoaLop}
            onChange={e=>setSearchKhoaLop(e.target.value)}
            className="form-input text-sm pl-8 pr-7 py-1.5 w-full"
            placeholder="Tìm theo Khóa, Gen hoặc Lớp..."
          />
          {searchKhoaLop&&(
            <button onClick={()=>setSearchKhoaLop('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <Icon name="x" size={12}/>
            </button>
          )}
        </div>
        {(selectedBan||searchKhoaLop)&&(
          <button onClick={()=>{setSelectedBan('');setSearchKhoaLop('')}} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
            <Icon name="x-circle" size={13}/>Xóa lọc
          </button>
        )}
        {viewMode==='attendance'&&<button onClick={()=>setSessionModal(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={12}/>Thêm buổi</button>}
        {viewMode==='tasks'&&<button onClick={()=>setTaskModal(true)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1"><Icon name="plus" size={12}/>Thêm bài tập</button>}
      </div>

      {members.length===0&&<div className="card py-16 text-center"><Icon name="users" size={40} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-400 font-medium">Chưa có thành viên nào</p></div>}

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
                        <span className={`status-badge text-[11px] ${m.role==='Ban Chủ Nhiệm'?'tag-blue':m.role==='CTV'?'tag-gray':'tag-green'}`}>{m.role}</span>
                        {(m.gen||m.khoa)&&<span className="status-badge tag-purple text-[11px]">{m.gen||m.khoa}</span>}
                        {m.lopHup&&<span className="status-badge tag-blue text-[11px]">{m.lopHup}</span>}
                        <span className={`status-badge text-[11px] ${evalColor(m.eval||'Đạt')}`}>{m.eval||'Đạt'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-slate-400">
                        {m.phone&&<span>📞 {m.phone}</span>}
                        {(m.skills||[]).length>0&&<span className="text-indigo-400">{(m.skills||[]).slice(0,2).join(' · ')}{(m.skills||[]).length>2?` +${(m.skills||[]).length-2}`:''}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                      <select value={m.eval||'Đạt'} onChange={e=>setEval(m.id,e.target.value)} disabled={!adminMode} className="form-input text-xs py-1 px-1.5 w-auto">{EVAL_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>
                      {(adminMode || (userIdentity && m.name && m.name.trim().toLowerCase() === userIdentity.trim().toLowerCase())) && (
                        <button onClick={()=>openEdit(m)} className="p-2 rounded-lg hover:bg-slate-100" title="Chỉnh sửa hồ sơ"><Icon name="pencil" size={14} className="text-slate-400"/></button>
                      )}
                      {adminMode && (
                        <button onClick={()=>setConfirmDel(m.id)} className="p-2 rounded-lg hover:bg-red-50" title="Xóa thành viên"><Icon name="trash-2" size={14} className="text-red-400"/></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredMembers.length>0&&(
            <div className="card p-4">
              <h3 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><Icon name="message-square" size={15} className="text-indigo-500"/>Ghi chú nhận xét thái độ</h3>
              <div className="space-y-2">
                {filteredMembers.map(m=>(
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">{m.name.charAt(0)}</div>
                    <p className="text-xs font-medium text-slate-700 w-28 flex-shrink-0 truncate">{m.name}</p>
                    <input value={m.note||''} onChange={e=>setNote(m.id,e.target.value)} placeholder="Nhận xét thái độ làm việc..." className="form-input flex-1 text-xs py-1.5"/>
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
            <div className="py-12 text-center"><Icon name="calendar-x" size={36} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">Thêm buổi sinh hoạt để bắt đầu điểm danh</p></div>
          ):(
            <table className="w-full text-sm min-w-max">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left p-3 font-semibold text-slate-700 sticky left-0 bg-white min-w-[140px]">Thành viên</th>
                {sessions.map(s=><th key={s.id} className="p-3 font-semibold text-slate-700 text-center min-w-[130px]">
                  <div className="flex items-center justify-between gap-1"><span className="truncate text-xs">{s.name}</span><button onClick={()=>deleteSession(s.id)} className="text-red-300 hover:text-red-500"><Icon name="x" size={12}/></button></div>
                </th>)}
              </tr></thead>
              <tbody>
                {filteredMembers.map(m=>(
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-3 sticky left-0 bg-white hover:bg-slate-50">
                      <p className="font-medium text-slate-800 text-xs">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.ban||'—'}</p>
                    </td>
                    {sessions.map(s=>(
                      <td key={s.id} className="p-2 text-center">
                        <select value={m.attendance?.[s.id]||''} onChange={e=>setAttend(m.id,s.id,e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-1 py-1 bg-white w-full">
                          <option value="">—</option>
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
            <div className="py-12 text-center"><Icon name="file-x" size={36} className="text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-400">Thêm bài tập/nhiệm vụ để theo dõi tiến độ</p></div>
          ):(
            <table className="w-full text-sm min-w-max">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left p-3 font-semibold text-slate-700 sticky left-0 bg-white min-w-[140px]">Thành viên</th>
                {assignTasks.map(t=><th key={t.id} className="p-3 font-semibold text-slate-700 text-center min-w-[130px]">
                  <div className="flex items-center justify-between gap-1"><span className="truncate text-xs">{t.name}</span><button onClick={()=>deleteATask(t.id)} className="text-red-300 hover:text-red-500"><Icon name="x" size={12}/></button></div>
                </th>)}
              </tr></thead>
              <tbody>
                {filteredMembers.map(m=>(
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-3 sticky left-0 bg-white hover:bg-slate-50">
                      <p className="font-medium text-slate-800 text-xs">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.ban||'—'}</p>
                    </td>
                    {assignTasks.map(t=>(
                      <td key={t.id} className="p-2 text-center">
                        <select value={m.taskStatus?.[t.id]||''} onChange={e=>setTaskStat(m.id,t.id,e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-1 py-1 bg-white w-full">
                          <option value="">—</option>
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

      <Modal open={modal} onClose={handleClose} title={editing?'Chỉnh sửa thành viên':'Thêm thành viên / CTV mới'}>
        <div className="space-y-4">
          <div><label className="form-label">Họ và tên <span className="text-red-500">*</span></label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="form-input" placeholder="Họ và tên đầy đủ"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Vai trò</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="form-input">{MEMBER_ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
            <div><label className="form-label">Ban</label><select value={form.ban} onChange={e=>setForm(p=>({...p,ban:e.target.value}))} className="form-input"><option value="">Chọn ban...</option>{BANS.map(b=><option key={b}>{b}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Khóa / Gen CLB</label>
              <input
                value={form.gen||form.khoa||''}
                onChange={e=>setForm(p=>({...p,gen:e.target.value}))}
                className="form-input"
                placeholder="VD: Gen 17, K17, Gen 18..."
              />
            </div>
            <div>
              <label className="form-label">Lớp / Khóa trường HUP</label>
              <input
                value={form.lopHup||''}
                onChange={e=>setForm(p=>({...p,lopHup:e.target.value}))}
                className="form-input"
                placeholder="VD: A4K80, A1K79, S1K3..."
              />
            </div>
          </div>
          <div><label className="form-label">Đánh giá tổng kết</label><select value={form.eval} onChange={e=>setForm(p=>({...p,eval:e.target.value}))} className="form-input">{EVAL_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Số điện thoại</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="form-input" placeholder="0912345678"/></div>
            <div><label className="form-label">Email</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="form-input" placeholder="email@example.com"/></div>
          </div>
          <div>
            <label className="form-label">Thế mạnh chuyên môn</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SKILL_TAGS.map(s=>(
                <button key={s} type="button" onClick={()=>toggleSkill(s)} className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${(form.skills||[]).includes(s)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div><label className="form-label">Ghi chú thái độ</label><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} className="form-input resize-none min-h-[60px]" placeholder="Ghi chú nhận xét..."/></div>
          <div className="flex gap-2 pt-2"><button onClick={handleClose} className="btn-secondary flex-1">Hủy</button><button onClick={handleSave} className="btn-primary flex-1">{editing?'Lưu thay đổi':'Thêm thành viên'}</button></div>
        </div>
      </Modal>

      <Modal open={sessionModal} onClose={()=>setSessionModal(false)} title="Quản lý buổi sinh hoạt">
        <div className="space-y-3">
          <div className="flex gap-2"><input value={newSession} onChange={e=>setNewSession(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSession()} className="form-input flex-1" placeholder="VD: Họp Ban tuần 1 tháng 10..."/><button onClick={addSession} className="btn-primary px-4">Thêm</button></div>
          <div className="space-y-1 max-h-48 overflow-y-auto">{sessions.map(s=><div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><span className="text-sm">{s.name}</span><button onClick={()=>deleteSession(s.id)} className="text-red-400 hover:text-red-600"><Icon name="trash-2" size={14}/></button></div>)}{sessions.length===0&&<p className="text-sm text-slate-400 text-center py-4">Chưa có buổi nào</p>}</div>
          <button onClick={()=>setSessionModal(false)} className="btn-secondary w-full">Đóng</button>
        </div>
      </Modal>

      <Modal open={taskModal} onClose={()=>setTaskModal(false)} title="Quản lý bài tập / nhiệm vụ">
        <div className="space-y-3">
          <div className="flex gap-2"><input value={newATask} onChange={e=>setNewATask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addATask()} className="form-input flex-1" placeholder="VD: Bài tập kỹ năng tuần 1..."/><button onClick={addATask} className="btn-primary px-4">Thêm</button></div>
          <div className="space-y-1 max-h-48 overflow-y-auto">{assignTasks.map(t=><div key={t.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"><span className="text-sm">{t.name}</span><button onClick={()=>deleteATask(t.id)} className="text-red-400 hover:text-red-600"><Icon name="trash-2" size={14}/></button></div>)}{assignTasks.length===0&&<p className="text-sm text-slate-400 text-center py-4">Chưa có bài tập nào</p>}</div>
          <button onClick={()=>setTaskModal(false)} className="btn-secondary w-full">Đóng</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>handleDeleteMember(confirmDel)} message="Xóa thành viên và toàn bộ dữ liệu liên quan?"/>
    </div>
  );
}

// ============================================================
// ADMIN LOCK (MẬT KHẨ QUẢN TRỊ 1072)
// ============================================================
function AdminLock({onUnlock}){
  const[pin,setPin]=useState('');
  const[err,setErr]=useState(false);
  const{playSound,addNotification}=useContext(AppCtx);

  const handleSubmit=e=>{
    if(e&&e.preventDefault)e.preventDefault();
    if(pin.trim()==='1072'){
      try{playSound('success');}catch(e){}
      try{addNotification('👑 Đã xác thực quyền Quản trị BCN thành công!','success');}catch(e){}
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
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Khu Vực Quản Trị BCN</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Nội dung này được bảo mật nội bộ. Vui lòng nhập mã quản trị để mở khóa.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
        <div>
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={e=>setPin(e.target.value)}
            placeholder="Nhập mã quản trị..."
            className={`form-input text-center text-xl tracking-widest font-mono font-bold ${err?'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700':''}`}
            autoFocus
          />
          {err&&<p className="text-xs text-red-500 font-semibold mt-1.5 animate-shake">Mã quản trị không đúng. Vui lòng thử lại!</p>}
        </div>
        <button type="submit" className="btn-primary w-full py-2.5 font-bold text-sm shadow-md flex items-center justify-center gap-2">
          <Icon name="key" size={16}/> Mở Khóa Truy Cập
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
      try{addNotification('👑 Đã kích hoạt Chế độ Quản trị BCN','success');}catch(e){}
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
    <Modal open={isOpen} onClose={onClose} title="Đăng Nhập Quản Trị BCN">
      <form onSubmit={handleCheck} className="space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Nội dung này được bảo mật nội bộ. Vui lòng nhập mã quản trị để mở khóa.
        </p>
        <div>
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={e=>setPin(e.target.value)}
            placeholder="Nhập mã quản trị..."
            className={`form-input text-center text-xl tracking-widest font-mono font-bold ${err?'border-red-500 bg-red-50 text-red-700':''}`}
            autoFocus
          />
          {err&&<p className="text-xs text-red-500 font-semibold mt-1.5 text-center">Mã quản trị không chính xác!</p>}
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Hủy</button>
          <button type="submit" className="btn-primary flex-1 font-bold">Xác Nhận</button>
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
    try{triggerMascot('celebrate','✨ Quẻ lành hôm nay!');}catch(e){}
  };

  const card=cardIndex!==null?GACHA_CARDS[cardIndex]:null;

  return(
    <Modal open={isOpen} onClose={onClose} title="🎴 Gieo Quẻ Hôm Nay - NewVision Oracle">
      <div className="flex flex-col items-center justify-center py-4 space-y-4">
        <p className="text-xs text-slate-500 text-center max-w-sm">
          Mỗi ngày một thông điệp vũ trụ dành riêng cho bạn. Chạm vào lá bài để lật quẻ!
        </p>

        <div className="perspective-1000 w-64 h-96 cursor-pointer" onClick={drawCard}>
          <div className={`gacha-card-inner relative w-full h-full rounded-2xl shadow-2xl transform-style-3d ${flipped?'rotate-y-180 gacha-glow':''}`}>
            {/* Card Back */}
            <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 border-2 border-amber-400/60 p-5 flex flex-col items-center justify-between text-white select-none">
              <div className="w-full flex justify-between text-amber-300 text-xs font-mono"><span>✦</span><span>NEWVISION HUP</span><span>✦</span></div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full border-2 border-amber-300/40 flex items-center justify-center bg-indigo-950/60 shadow-[0_0_20px_rgba(251,191,36,0.35)]">
                  <span className="text-4xl animate-pulse">🔮</span>
                </div>
                <p className="text-sm font-bold text-amber-200 tracking-wider">CHẠM ĐỂ RÚT QUẺ</p>
                <p className="text-[10px] text-slate-400">1 quẻ duy nhất mỗi ngày</p>
              </div>
              <div className="w-full flex justify-between text-amber-300 text-xs font-mono"><span>✦</span><span>HUYỀN HỌC & TAROT</span><span>✦</span></div>
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
                      ★ Quẻ ngày {todayStr}
                    </span>
                  </div>
                </>
              ):null}
            </div>
          </div>
        </div>

        {flipped&&(
          <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <Icon name="check-circle" size={13}/> Đã ghi nhận quẻ hôm nay của bạn!
          </p>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// ============================================================
// ============================================================
// ============================================================
// VIETNAMESE POPULAR BANKS & E-WALLETS (VIETQR / NAPAS STANDARDS)
// ============================================================
const POPULAR_BANKS = [
  // --- Ngân hàng thương mại phổ biến ---
  { code: 'MB', name: 'MB Bank (Quân Đội)', bin: '970422', type: 'bank' },
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương)', bin: '970436', type: 'bank' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương)', bin: '970407', type: 'bank' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)', bin: '970432', type: 'bank' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)', bin: '970423', type: 'bank' },
  { code: 'ICB', name: 'VietinBank (Công Thương)', bin: '970415', type: 'bank' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư & Phát Triển)', bin: '970418', type: 'bank' },
  { code: 'ACB', name: 'ACB (Á Châu)', bin: '970416', type: 'bank' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)', bin: '970403', type: 'bank' },
  { code: 'HDB', name: 'HDBank (Phát Triển TP.HCM)', bin: '970437', type: 'bank' },
  { code: 'VIB', name: 'VIB (Quốc Tế)', bin: '970441', type: 'bank' },
  { code: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)', bin: '970443', type: 'bank' },
  { code: 'MSB', name: 'MSB (Hàng Hải)', bin: '970426', type: 'bank' },
  { code: 'OCB', name: 'OCB (Phương Đông)', bin: '970448', type: 'bank' },
  { code: 'LPB', name: 'LPBank (Lộc Phát)', bin: '970449', type: 'bank' },
  { code: 'SEAB', name: 'SeABank (Đông Nam Á)', bin: '970440', type: 'bank' },
  // --- Ví điện tử (MoMo, Viettel Money, ZaloPay, ShopeePay, VNPT Money) ---
  { code: 'MOMO', name: 'Ví điện tử MoMo', bin: '971025', type: 'wallet' },
  { code: 'VIETTELMONEY', name: 'Viettel Money (ViettelPay / Dịch vụ Số Viettel)', bin: '971005', type: 'wallet' },
  { code: 'ZALOPAY', name: 'Ví điện tử ZaloPay', bin: '971101', type: 'wallet' },
  { code: 'SHOPEEPAY', name: 'Ví điện tử ShopeePay', bin: '970440', type: 'wallet' },
  { code: 'VNPTMONEY', name: 'VNPT Money', bin: '971011', type: 'wallet' }
];

const getVietQrBankCode = (bankCode) => {
  if (!bankCode) return 'MB';
  const upper = String(bankCode).trim().toUpperCase();
  const found = POPULAR_BANKS.find(b => b.code.toUpperCase() === upper || (b.bin && b.bin === upper));
  if (found) {
    if (found.type === 'wallet') {
      return found.bin || found.code;
    }
    return found.code;
  }
  return upper;
};

// Đơn vị và mapping tài liệu Firestore club_qr_accounts
const QR_DOC_KEYS = {
  'all': 'clb_common',
  'Toàn CLB': 'clb_common',
  'Toàn CLB (Quỹ chung)': 'clb_common',
  'Nội vụ': 'ban_noivu',
  'Ban Nội Vụ': 'ban_noivu',
  'Sự kiện': 'ban_sukien',
  'Ban Sự Kiện': 'ban_sukien',
  'Truyền thông': 'ban_truyenthong',
  'Ban Truyền Thông': 'ban_truyenthong',
  'Đối ngoại': 'ban_doingoai',
  'Ban Đối Ngoại': 'ban_doingoai'
};

const QR_UNITS = [
  { id: 'all', docKey: 'clb_common', label: 'Toàn CLB (Quỹ chung)', short: 'CLB' },
  { id: 'Nội vụ', docKey: 'ban_noivu', label: 'Ban Nội Vụ', short: 'NOIVU' },
  { id: 'Sự kiện', docKey: 'ban_sukien', label: 'Ban Sự Kiện', short: 'SUKIEN' },
  { id: 'Truyền thông', docKey: 'ban_truyenthong', label: 'Ban Truyền Thông', short: 'TRUYENTHONG' },
  { id: 'Đối ngoại', docKey: 'ban_doingoai', label: 'Ban Đối Ngoại', short: 'DOINGOAI' }
];

const removeVietnameseTones = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
};

// Hàm nén ảnh mã QR sang Base64 nhỏ gọn (max 600px, quality 0.85, an toàn Firestore < 1MB)
const compressQrImageFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Chưa chọn file!'));
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Vui lòng chọn file hình ảnh (PNG, JPG, JPEG, WEBP)!'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (err) {
          const rawUrl = e.target.result;
          if (rawUrl && rawUrl.length < 900000) {
            resolve(rawUrl);
          } else {
            reject(new Error('Kích thước ảnh quá lớn, vui lòng chọn ảnh dung lượng dưới 1MB!'));
          }
        }
      };
      img.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn!'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file từ thiết bị!'));
    reader.readAsDataURL(file);
  });
};

// ============================================================
// VIETQR & PAYMENT QR MODAL (HỖ TRỢ QR TỪNG BAN & QUỸ CHUNG)
// ============================================================
function VietQRModal({ isOpen, onClose, penalty }) {
  const { playSound, addNotification, penaltyAccount, qrAccounts = {} } = useContext(AppCtx);
  const [copied, setCopied] = useState(false);
  if (!isOpen || !penalty) return null;

  // Kiểm tra Ban của bản ghi phạt để lấy đúng tài khoản QR
  const ban = (penalty.ban || '').trim();
  const banDocKey = QR_DOC_KEYS[ban] || ban;
  const banAcc = (qrAccounts && (qrAccounts[banDocKey] || qrAccounts[ban]));
  const commonAcc = (qrAccounts && (qrAccounts['clb_common'] || qrAccounts['all'])) || penaltyAccount;

  let activeAccount = null;
  let unitScopeLabel = '';

  if (banAcc && (banAcc.accountNo?.trim() || banAcc.customQrUrl?.trim())) {
    activeAccount = banAcc;
    unitScopeLabel = `Ban ${ban}`;
  } else if (commonAcc && (commonAcc.accountNo?.trim() || commonAcc.customQrUrl?.trim())) {
    activeAccount = commonAcc;
    unitScopeLabel = ban ? `Quỹ chung CLB (Ban ${ban} chưa có QR riêng)` : 'Quỹ chung CLB';
  }

  const hasCustomQr = !!(activeAccount && activeAccount.customQrUrl && activeAccount.customQrUrl.trim());
  const hasBankAcc = !!(activeAccount && activeAccount.accountNo && activeAccount.accountNo.trim());
  const isConfigured = !!activeAccount && (hasCustomQr || hasBankAcc);

  if (!isConfigured) {
    return (
      <Modal open={isOpen} onClose={onClose} title="Quét Mã QR Nộp Quỹ">
        <div className="flex flex-col items-center py-6 px-4 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Icon name="alert-triangle" size={32} />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              BCN chưa cấu hình thông tin chuyển khoản
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Chưa có thông tin tài khoản cho {ban ? `Ban ${ban}` : 'CLB'} và Quỹ chung CLB cũng chưa được thiết lập. Vui lòng liên hệ BCN hoặc Quản trị viên mở phần cài đặt tài khoản để cấu hình.
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary px-6 py-2 text-xs font-bold rounded-xl">
            Đóng
          </button>
        </div>
      </Modal>
    );
  }

  const amount = Math.abs(penalty.amount || 20000);
  const rawBank = activeAccount.bank ? activeAccount.bank.trim().toUpperCase() : 'MB';
  const bankDisplay = activeAccount.bankName || rawBank;
  const accNo = activeAccount.accountNo ? activeAccount.accountNo.trim() : '';
  const qrIdentifier = getVietQrBankCode(rawBank);

  // Nội dung chuyển khoản tự sinh chuẩn: NVPHAT [TEN_BAN] [TEN_TV]
  const banTag = removeVietnameseTones(penalty.ban || 'CLB').toUpperCase().replace(/\s+/g, '');
  const nameTag = removeVietnameseTones(penalty.name || '').toUpperCase();
  const transferContent = `NVPHAT ${banTag} ${nameTag}`.trim();

  // Ưu tiên ảnh QR tải lên nếu có, ngược lại tự động tạo mã VietQR chuẩn
  const qrUrl = hasCustomQr
    ? activeAccount.customQrUrl.trim()
    : `https://img.vietqr.io/image/${qrIdentifier}-${accNo}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}`;

  const copyInfo = () => {
    const namePart = activeAccount.accountName ? ` - Chu TK: ${activeAccount.accountName}` : '';
    const accPart = accNo ? ` - STK: ${accNo}` : '';
    const text = `${bankDisplay}${accPart}${namePart} - So tien: ${amount.toLocaleString('vi-VN')}d - ND: ${transferContent}`;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      try { playSound('pop'); } catch (e) {}
      try { addNotification('Đã sao chép thông tin chuyển khoản!', 'success'); } catch (e) {}
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Quét Mã QR Nộp Quỹ">
      <div className="flex flex-col items-center space-y-3.5 py-1">
        {/* Đơn vị nhận badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <Icon name="credit-card" size={13} />
          <span>Tài khoản nhận: {unitScopeLabel}</span>
        </div>

        <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-xs text-center">
          <img
            src={qrUrl}
            alt="Mã QR Chuyển Khoản"
            className="w-56 h-auto rounded-xl mx-auto max-h-64 object-contain"
            onError={e => {
              e.target.src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(transferContent);
            }}
          />
          {hasCustomQr && (
            <div className="mt-2 text-center">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <Icon name="check-circle" size={12} /> Ảnh QR do Trưởng ban/BCN tải lên
              </span>
            </div>
          )}
        </div>

        <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between">
            <span className="text-slate-500">Đơn vị nhận:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{unitScopeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Ngân hàng / Ví:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{bankDisplay}</span>
          </div>
          {accNo && (
            <div className="flex justify-between">
              <span className="text-slate-500">Số tài khoản / SĐT:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{accNo}</span>
            </div>
          )}
          {activeAccount.accountName && (
            <div className="flex justify-between">
              <span className="text-slate-500">Chủ tài khoản / ví:</span>
              <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{activeAccount.accountName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Số tiền nộp:</span>
            <span className="font-bold text-amber-600">{amount.toLocaleString('vi-VN')} đ</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-semibold">Nội dung CK:</span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-xs">{transferContent}</span>
          </div>
        </div>

        <div className="flex gap-2 w-full pt-1">
          <button onClick={copyInfo} className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 font-bold">
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            <span>{copied ? 'Đã sao chép' : 'Sao chép thông tin'}</span>
          </button>
          <button onClick={onClose} className="btn-primary flex-1 py-2 text-xs font-bold">
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}


// ============================================================
// NỘI QUY & THƯỞNG PHẠT (PENALTIES & REWARDS MODULE)
// ============================================================
function PenaltiesPage() {
  const { penalties, setPenalties, adminMode, addNotification, playSound, members, clubRules, setClubRules, penaltyAccount, setPenaltyAccount, qrAccounts = {}, setQrAccounts } = useContext(AppCtx);
  const [subTab, setSubTab] = useState('penalties'); // 'penalties' | 'rules'
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [qrPenalty, setQrPenalty] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterBan, setFilterBan] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

      // Bank settings state (Hỗ trợ từng Ban & Toàn CLB)
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [bankModal, setBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank: 'MB',
    bankName: 'MB Bank (Quân Đội)',
    accountNo: '',
    accountName: '',
    customQrUrl: ''
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const loadUnitIntoForm = (unitId) => {
    setSelectedUnit(unitId);
    const docKey = QR_DOC_KEYS[unitId] || unitId;
    const acc = (qrAccounts && (qrAccounts[docKey] || qrAccounts[unitId])) || (unitId === 'all' ? penaltyAccount : null);
    if (acc) {
      setBankForm({
        bank: acc.bank || 'MB',
        bankName: acc.bankName || 'MB Bank (Quân Đội)',
        accountNo: acc.accountNo || '',
        accountName: acc.accountName || '',
        customQrUrl: acc.customQrUrl || ''
      });
    } else {
      setBankForm({
        bank: 'MB',
        bankName: 'MB Bank (Quân Đội)',
        accountNo: '',
        accountName: '',
        customQrUrl: ''
      });
    }
  };

  const openBankModal = () => {
    loadUnitIntoForm('all');
    setBankModal(true);
  };

  const handleQrFileUpload = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const dataUrl = await compressQrImageFile(file);
      setBankForm(p => ({ ...p, customQrUrl: dataUrl }));
      try { playSound('pop'); } catch (err) {}
      try { addNotification('Đã tải ảnh mã QR từ thiết bị thành công!', 'success'); } catch (err) {}
    } catch (err) {
      alert(err.message || 'Lỗi khi tải ảnh!');
    } finally {
      setUploadingQr(false);
      e.target.value = '';
    }
  };

  const handleRemoveQrImage = () => {
    setBankForm(p => ({ ...p, customQrUrl: '' }));
    try { playSound('pop'); } catch (err) {}
    try { addNotification('Đã xóa ảnh QR tải lên, quay về VietQR tự sinh.', 'info'); } catch (err) {}
  };

  const handleSaveBank = async e => {
    if (e && e.preventDefault) e.preventDefault();
    if (!bankForm.accountNo.trim() && !bankForm.customQrUrl.trim()) {
      alert('Vui lòng nhập Số tài khoản hoặc tải lên ảnh QR từ thiết bị!');
      return;
    }
    setBankSaving(true);
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      const unitDocKey = QR_DOC_KEYS[selectedUnit] || selectedUnit;
      const unitObj = QR_UNITS.find(u => u.id === selectedUnit);
      const unitLabel = unitObj ? unitObj.label : selectedUnit;

      const cleanData = {
        unit: selectedUnit,
        unitDocKey,
        unitLabel,
        bank: bankForm.bank.trim().toUpperCase(),
        bankName: bankForm.bankName.trim(),
        accountNo: bankForm.accountNo.trim(),
        accountName: bankForm.accountName.trim().toUpperCase(),
        customQrUrl: bankForm.customQrUrl ? bankForm.customQrUrl.trim() : '',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin BCN'
      };

      await fbDb.collection('club_qr_accounts').doc(unitDocKey).set(cleanData, { merge: true });

      if (selectedUnit === 'all' || selectedUnit === 'Toàn CLB') {
        await fbDb.collection('club_settings').doc('penalty_account').set(cleanData, { merge: true });
        if (setPenaltyAccount) setPenaltyAccount(cleanData);
      }

      if (setQrAccounts) {
        setQrAccounts(prev => ({ ...prev, [unitDocKey]: cleanData, [selectedUnit]: cleanData }));
      }

      try { playSound('success'); } catch (err) {}
      try { addNotification(✅ Đã lưu cấu hình tài khoản nộp phạt cho !, 'success'); } catch (err) {}
      setBankModal(false);
    } catch (err) {
      alert('Lỗi lưu tài khoản: ' + err.message);
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
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('club_settings').doc('rules').set({
        content: rulesDraft,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin BCN'
      }, { merge: true });
      try { playSound('success'); } catch (e) {}
      try { addNotification('✅ Đã cập nhật Nội Quy CLB lên Cloud Firestore!', 'success'); } catch (e) {}
      setEditingRules(false);
    } catch (err) {
      alert('Lỗi lưu Firebase: ' + err.message);
    } finally {
      setRulesSaving(false);
    }
  };

  const emptyForm = { name: '', ban: 'Nội vụ', reason: '', amount: 20000, type: 'phat', status: 'Chờ nộp' };
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
      ban: item.ban || 'Nội vụ',
      reason: item.reason || '',
      amount: Math.abs(item.amount || 20000),
      type: item.type || (item.amount < 0 ? 'phat' : 'thuong'),
      status: item.status || 'Chờ nộp'
    });
    setModal(true);
  };

  const handleSave = async e => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.name.trim()) { alert('Vui lòng chọn hoặc nhập tên thành viên!'); return; }
    if (!form.reason.trim()) { alert('Vui lòng nhập lý do!'); return; }
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      const amountVal = form.type === 'thuong' ? Math.abs(form.amount) : -Math.abs(form.amount);

      if (editingId) {
        const updatedRec = {
          name: form.name.trim(),
          ban: form.ban,
          reason: form.reason.trim(),
          amount: amountVal,
          type: form.type,
          status: form.type === 'thuong' ? 'Đã trao' : form.status,
          updatedAt: new Date().toISOString()
        };
        await fbDb.collection('penalties').doc(editingId).set(updatedRec, { merge: true });
        setPenalties(prev => prev.map(p => p.id === editingId ? { ...p, ...updatedRec } : p));
        try { playSound('success'); } catch (e) {}
        try { addNotification(`Đã cập nhật ${form.type === 'thuong' ? 'khen thưởng' : 'vi phạm'}: ${form.name}`, 'success'); } catch (e) {}
      } else {
        const id = uid();
        const newRec = {
          id,
          name: form.name.trim(),
          ban: form.ban,
          reason: form.reason.trim(),
          amount: amountVal,
          type: form.type,
          status: form.type === 'thuong' ? 'Đã trao' : form.status,
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString()
        };
        await fbDb.collection('penalties').doc(id).set(newRec);
        try { playSound('success'); } catch (e) {}
        try { addNotification(`Đã ghi nhận ${form.type === 'thuong' ? 'khen thưởng' : 'vi phạm'}: ${form.name}`, 'info'); } catch (e) {}
      }
      setModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      alert('Lỗi lưu Firebase: ' + err.message);
    }
  };

  const toggleStatus = async item => {
    if (!adminMode) {
      alert('Chỉ Ban Chủ Nhiệm mới có quyền duyệt trạng thái nộp phạt!');
      return;
    }
    const newStatus = item.status === 'Đã nộp' ? 'Chờ nộp' : 'Đã nộp';
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('penalties').doc(item.id).set({ status: newStatus }, { merge: true });
      try { playSound('pop'); } catch (e) {}
      try { addNotification(`Đã chuyển trạng thái sang "${newStatus}": ${item.name}`, 'success'); } catch (e) {}
    } catch (err) {
      alert('Lỗi lưu Firebase: ' + err.message);
    }
  };

  const handleDelete = async id => {
    if (!adminMode) {
      alert('Chỉ Ban Chủ Nhiệm mới có quyền xóa bản ghi!');
      return;
    }
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('penalties').doc(id).delete();
      setPenalties(prev => prev.filter(p => p.id !== id));
      try { playSound('pop'); } catch (e) {}
      try { addNotification('Đã xóa vĩnh viễn bản ghi khỏi Cloud Firestore', 'info'); } catch (e) {}
      setConfirmDel(null);
    } catch (err) {
      alert('Lỗi xóa Firebase: ' + err.message);
    }
  };

  const filtered = (penalties || []).filter(item => {
    if (filterType === 'pending' && item.status !== 'Chờ nộp') return false;
    if (filterType === 'done' && item.status === 'Chờ nộp') return false;
    if (filterBan && item.ban !== filterBan) return false;
    return true;
  });

  const totalPending = (penalties || []).filter(p => p.status === 'Chờ nộp').reduce((acc, cur) => acc + Math.abs(cur.amount || 0), 0);
  const totalCollected = (penalties || []).filter(p => p.status === 'Đã nộp' && p.amount < 0).reduce((acc, cur) => acc + Math.abs(cur.amount || 0), 0);

  return (
    <div className="space-y-4 fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Icon name="scale" size={20} className="text-orange-600" />
            Nội Quy & Thưởng Phạt CLB
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Theo dõi vi phạm, nộp phạt qua VietQR tự động và vinh danh khen thưởng</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {adminMode && subTab === 'penalties' && (
            <button
              onClick={openBankModal}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Cài đặt tài khoản ngân hàng nhận tiền phạt nộp quỹ"
            >
              <Icon name="settings" size={14} className="text-orange-600" />
              <span>⚙️ Cài đặt tài khoản nộp phạt</span>
            </button>
          )}
          {subTab === 'penalties' && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 shadow-sm">
              <Icon name="plus" size={15} /> Ghi nhận mới
            </button>
          )}
          {subTab === 'rules' && adminMode && !editingRules && (
            <button onClick={openEditRules} className="btn-primary flex items-center gap-1.5 shadow-sm">
              <Icon name="pencil" size={15} /> Chỉnh sửa nội quy
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
          ⚖️ Thưởng & Phạt
        </button>
        <button
          onClick={() => setSubTab('rules')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${subTab === 'rules' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
        >
          📋 Nội Quy CLB
        </button>
      </div>

      {/* RULES SUB-TAB */}
      {subTab === 'rules' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
              <Icon name="book-open" size={18} className="text-indigo-500" />
              Quy Chế & Nội Quy CLB NewVision HUP
            </h2>
            {adminMode && editingRules && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingRules(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={rulesSaving}
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveRules}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  disabled={rulesSaving}
                >
                  {rulesSaving ? 'Đang lưu...' : '💾 Lưu nội quy'}
                </button>
              </div>
            )}
          </div>

          {adminMode && editingRules ? (
            <div>
              <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                Nhập nội quy theo từng dòng. Dùng "•" hoặc "-" đầu dòng cho gạch đầu dòng. Nội dung sẽ được lưu lên Cloud và hiển thị cho toàn CLB.
              </p>
              <textarea
                value={rulesDraft}
                onChange={e => setRulesDraft(e.target.value)}
                className="form-input w-full resize-y min-h-[320px] font-mono text-sm leading-relaxed"
                placeholder={"• Điều 1: Tất cả thành viên phải tham dự họp CLB đúng giờ.\n• Điều 2: Hoàn thành nhiệm vụ được giao trước deadline.\n• Điều 3: Đi muộn dưới 15 phút phạt 10.000đ...\n\n(Nhập nội quy của CLB bạn tại đây)"}
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
                  <p className="font-semibold text-sm">Chưa có nội quy CLB</p>
                  {adminMode ? (
                    <p className="text-xs mt-1">Bấm "Chỉnh sửa nội quy" ở trên để soạn thảo và lưu lên Cloud.</p>
                  ) : (
                    <p className="text-xs mt-1">Nội quy CLB chưa được thiết lập bởi Ban Chủ Nhiệm.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!adminMode && clubRules && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Icon name="info" size={11} /> Chỉ Ban Chủ Nhiệm có thể chỉnh sửa nội quy. Nội quy luôn đồng bộ realtime từ Cloud Firestore.
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
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Tiền phạt chờ nộp</span>
              <p className="text-lg font-black text-amber-600 mt-1">{totalPending.toLocaleString('vi-VN')} đ</p>
            </div>
            <div className="card p-3 border-l-4 border-emerald-500">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Đã thu vào quỹ</span>
              <p className="text-lg font-black text-emerald-600 mt-1">{totalCollected.toLocaleString('vi-VN')} đ</p>
            </div>
            <div className="card p-3 border-l-4 border-indigo-500 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số lượt ghi nhận</span>
              <p className="text-lg font-black text-indigo-600 mt-1">{(penalties || []).length} lượt</p>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterType === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Tất cả ({(penalties || []).length})
              </button>
              <button
                onClick={() => setFilterType('pending')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterType === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Chờ nộp ({(penalties || []).filter(p => p.status === 'Chờ nộp').length})
              </button>
              <button
                onClick={() => setFilterType('done')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterType === 'done' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Đã nộp / Trao ({(penalties || []).filter(p => p.status !== 'Chờ nộp').length})
              </button>
            </div>

            <select
              value={filterBan}
              onChange={e => setFilterBan(e.target.value)}
              className="form-input text-xs py-1 px-2.5 max-w-[140px]"
            >
              <option value="">Tất cả ban</option>
              {['Nội vụ', 'Truyền thông', 'Sự kiện', 'Đối ngoại'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Records Table / Cards */}
          <div className="space-y-2.5">
            {filtered.length === 0 && (
              <div className="card py-12 text-center text-slate-400">
                <Icon name="check-circle-2" size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-sm">Không có dữ liệu thưởng phạt phù hợp</p>
              </div>
            )}
            {filtered.map(item => {
              const isPenalty = (item.amount || 0) < 0 || item.type === 'phat';
              const isPending = item.status === 'Chờ nộp';
              return (
                <div key={item.id} className="card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-sm transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.name}</span>
                      {item.ban && <span className="status-badge tag-gray text-[10px]">{item.ban}</span>}
                      <span className={`status-badge text-[10px] ${isPending ? 'tag-yellow' : 'tag-green'}`}>
                        {item.status || 'Chờ nộp'}
                      </span>
                      <span className="text-[11px] text-slate-400">{item.date}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.reason}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <p className={`font-mono font-bold text-sm ${isPenalty ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isPenalty ? `-${Math.abs(item.amount || 0).toLocaleString('vi-VN')} đ` : `+${Math.abs(item.amount || 0).toLocaleString('vi-VN')} đ`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPenalty && isPending && (
                        <button
                          onClick={() => setQrPenalty(item)}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold text-xs flex items-center gap-1 border border-orange-200 transition"
                          title="Mở mã QR nộp phạt"
                        >
                          <Icon name="qr-code" size={13} /> Nộp phạt
                        </button>
                      )}

                      {adminMode && (
                        <button
                          onClick={() => toggleStatus(item)}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition border ${
                            item.status === 'Đã nộp'
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-300'
                          }`}
                          title="Chuyển trạng thái nộp"
                        >
                          {item.status === 'Đã nộp' ? 'Chưa nộp' : 'Đã nộp ✓'}
                        </button>
                      )}

                      {adminMode && (
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Chỉnh sửa bản ghi"
                        >
                          <Icon name="pencil" size={14} />
                        </button>
                      )}

                      {adminMode && (
                        <button
                          onClick={() => setConfirmDel(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Xóa bản ghi"
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
          <Modal open={modal} onClose={() => { setModal(false); setEditingId(null); }} title={editingId ? "Chỉnh Sửa Bản Ghi Thưởng / Phạt" : "Ghi Nhận Thưởng / Phạt Mới"}>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="form-label">Loại ghi nhận</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: 'phat', status: 'Chờ nộp' }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${form.type === 'phat' ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    ⚠️ Vi phạm nội quy (Phạt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: 'thuong', status: 'Đã trao' }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${form.type === 'thuong' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    🏆 Tuyên dương (Thưởng)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Thành viên <span className="text-red-500">*</span></label>
                  <select
                    value={form.name}
                    onChange={e => {
                      const val = e.target.value;
                      const m = members.find(mem => mem.name === val);
                      setForm(p => ({ ...p, name: val, ban: m && m.ban ? m.ban : p.ban }));
                    }}
                    className="form-input"
                  >
                    <option value="">-- Chọn thành viên --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.name}>{m.name} ({m.ban || 'Thành viên'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Ban</label>
                  <select value={form.ban} onChange={e => setForm(p => ({ ...p, ban: e.target.value }))} className="form-input">
                    {['Nội vụ', 'Truyền thông', 'Sự kiện', 'Đối ngoại', 'Toàn CLB'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Số tiền (VNĐ) <span className="text-red-500">*</span></label>
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
                  <label className="form-label">Trạng thái</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="form-input">
                    <option value="Chờ nộp">Chờ nộp</option>
                    <option value="Đã nộp">Đã nộp</option>
                    <option value="Đã trao">Đã trao</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Lý do vi phạm / Khen thưởng <span className="text-red-500">*</span></label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  className="form-input resize-none min-h-[70px]"
                  placeholder="VD: Đi muộn họp định kỳ 15 phút, Hoàn thành xuất sắc nhiệm vụ..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setModal(false); setEditingId(null); }} className="btn-secondary flex-1">Hủy</button>
                <button type="submit" className="btn-primary flex-1 font-bold">{editingId ? "Lưu thay đổi" : "Lưu ghi nhận"}</button>
              </div>
            </form>
          </Modal>

                              {/* Modal Cài đặt tài khoản nhận nộp phạt */}
          <Modal open={bankModal} onClose={() => setBankModal(false)} title="⚙️ Cài Đặt Tài Khoản Nhận Nộp Phạt">
            <form onSubmit={handleSaveBank} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Cấu hình tài khoản ngân hàng / ví điện tử hoặc tải ảnh QR riêng cho <b>từng Ban</b> hoặc <b>Toàn CLB (Quỹ chung)</b>. Khi thành viên nộp phạt, hệ thống sẽ tự động hiển thị đúng QR của Ban đó.
              </p>

              {/* Selector for target unit */}
              <div>
                <label className="form-label font-bold text-indigo-700 dark:text-indigo-400">
                  Đơn vị áp dụng tài khoản <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUnit}
                  onChange={e => loadUnitIntoForm(e.target.value)}
                  className="form-input border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 font-bold"
                >
                  {QR_UNITS.map(u => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 Chọn đơn vị để xem và chỉnh sửa thông tin tài khoản / QR riêng của đơn vị đó.
                </p>
              </div>

              <div>
                <label className="form-label">Ngân hàng / Ví điện tử thụ hưởng <span className="text-red-500">*</span></label>
                <select
                  value={bankForm.bank}
                  onChange={e => {
                    const code = e.target.value;
                    const found = POPULAR_BANKS.find(b => b.code === code);
                    setBankForm(p => ({ ...p, bank: code, bankName: found ? found.name : code }));
                  }}
                  className="form-input"
                >
                  <optgroup label="🏦 Ngân hàng thương mại">
                    {POPULAR_BANKS.filter(b => b.type === 'bank').map(b => (
                      <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📱 Ví điện tử">
                    {POPULAR_BANKS.filter(b => b.type === 'wallet').map(b => (
                      <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    {POPULAR_BANKS.find(b => b.code === bankForm.bank)?.type === 'wallet' ? 'Số tài khoản / SĐT đăng ký ví' : 'Số tài khoản'} {!bankForm.customQrUrl && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={bankForm.accountNo}
                    onChange={e => setBankForm(p => ({ ...p, accountNo: e.target.value }))}
                    className="form-input font-mono font-bold"
                    placeholder={POPULAR_BANKS.find(b => b.code === bankForm.bank)?.type === 'wallet' ? 'Ví dụ: 0987654321...' : 'Ví dụ: 123456789...'}
                    required={!bankForm.customQrUrl}
                  />
                </div>
                <div>
                  <label className="form-label">Tên chủ tài khoản / ví</label>
                  <input
                    type="text"
                    value={bankForm.accountName}
                    onChange={e => setBankForm(p => ({ ...p, accountName: e.target.value.toUpperCase() }))}
                    className="form-input uppercase"
                    placeholder="Ví dụ: NGUYEN VAN A"
                  />
                </div>
              </div>

              {/* Tải ảnh QR trực tiếp từ thiết bị */}
              <div className="space-y-2">
                <label className="form-label block">
                  Ảnh mã QR thụ hưởng từ thiết bị <span className="text-slate-400 font-normal">(Ưu tiên hiển thị nếu có)</span>
                </label>
                <input
                  type="file"
                  id="qrFileInput"
                  accept="image/*"
                  className="hidden"
                  onChange={handleQrFileUpload}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { const el = document.getElementById('qrFileInput'); if (el) el.click(); }}
                    disabled={uploadingQr}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Icon name={uploadingQr ? 'loader' : 'upload'} size={15} className={uploadingQr ? 'animate-spin' : ''} />
                    <span>{uploadingQr ? 'Đang xử lý ảnh...' : '📁 Tải ảnh QR từ máy (PNG, JPG)'}</span>
                  </button>
                  {bankForm.customQrUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveQrImage}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-medium hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
                    >
                      <Icon name="trash-2" size={14} />
                      <span>Xóa ảnh đã tải</span>
                    </button>
                  )}
                </div>

                {/* Khung xem trước (preview) nhỏ gọn */}
                {bankForm.customQrUrl ? (
                  <div className="p-3 bg-indigo-50/50 dark:bg-slate-800/80 rounded-xl border border-indigo-200 dark:border-indigo-700 flex items-center gap-3">
                    <img
                      src={bankForm.customQrUrl}
                      alt="QR Preview"
                      className="w-16 h-16 rounded-lg object-contain bg-white border border-slate-200 shadow-sm flex-shrink-0"
                    />
                    <div className="text-xs space-y-1 min-w-0">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Icon name="check-circle" size={13} /> Đã có ảnh QR riêng cho {QR_UNITS.find(u => u.id === selectedUnit)?.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Hệ thống sẽ <strong>ưu tiên hiển thị ảnh QR này</strong> thay cho mã tự sinh khi thành viên nộp phạt cho đơn vị này.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Nếu không tải ảnh riêng, hệ thống sẽ tự động tạo mã VietQR chuẩn ngân hàng/ví từ thông tin bên trên.
                  </p>
                )}
              </div>

              {/* Mini Preview cho trường hợp tự sinh VietQR */}
              {!bankForm.customQrUrl && bankForm.accountNo && bankForm.bank && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <img
                    src={https://img.vietqr.io/image/--compact.png?amount=20000&addInfo=XEMTRUOC}
                    alt="Preview QR"
                    className="w-14 h-14 rounded-lg border bg-white object-contain flex-shrink-0"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div className="text-xs space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{bankForm.bankName || bankForm.bank}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-semibold">VietQR Auto</span>
                    </div>
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
                  disabled={bankSaving || uploadingQr}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 font-bold"
                  disabled={bankSaving || uploadingQr}
                >
                  {bankSaving ? 'Đang lưu...' : '💾 Lưu cấu hình ' + (QR_UNITS.find(u => u.id === selectedUnit)?.short || '')}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}

      <VietQRModal isOpen={!!qrPenalty} onClose={() => setQrPenalty(null)} penalty={qrPenalty} />
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} message="Xóa bản ghi thưởng/phạt này?" />
    </div>
  );
}
// ============================================================
// ============================================================
// TÀI NGUYÊN & QUỸ CLB (RESOURCES, INVENTORY & CLUB FUNDS)
// ============================================================
const FUND_BANS = ['Quỹ CLB', 'Ban Nội Vụ', 'Ban Sự Kiện', 'Ban Truyền Thông', 'Ban Đối Ngoại'];

function ResourcesPage() {
  const {
    resources, setResources,
    inventory, setInventory,
    clubFunds = [], setClubFunds,
    addNotification, playSound,
    studyResources, events, adminMode
  } = useContext(AppCtx);

  const [tab, setTab] = useState('links'); // 'links' | 'inventory' | 'funds'
  const [dupWarning, setDupWarning] = useState(null);

  // --- TAB 1: KHO LINK ---
  const [filterBan, setFilterBan] = useState('');
  const [filterType, setFilterType] = useState('');
  const emptyLink = { title: '', url: '', ban: '', type: LINK_TYPES[0], note: '' };
  const [linkForm, setLinkForm] = useState(emptyLink);
  const [linkModal, setLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [confirmDelLink, setConfirmDelLink] = useState(null);

  // --- TAB 2: VẬT DỤNG ---
  const emptyInv = { name: '', quantity: 1, status: 'Tốt', keeper: '', location: '', note: '' };
  const [invForm, setInvForm] = useState(emptyInv);
  const [invModal, setInvModal] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [confirmDelInv, setConfirmDelInv] = useState(null);

  // --- TAB 3: SỔ QUỸ CLB & CÁC BAN ---
  const emptyFund = {
    date: new Date().toISOString().slice(0, 10),
    ban: 'Quỹ CLB',
    content: '',
    type: 'thu', // 'thu' | 'chi'
    amount: '',
    person: '',
    note: ''
  };
  const [fundForm, setFundForm] = useState(emptyFund);
  const [fundModal, setFundModal] = useState(false);
  const [editingFund, setEditingFund] = useState(null);
  const [confirmDelFund, setConfirmDelFund] = useState(null);
  const [fundBanFilter, setFundBanFilter] = useState('Tất cả');
  const [fundSearch, setFundSearch] = useState('');
  const [fundSaving, setFundSaving] = useState(false);

  // Open modals
  const openAddLink = () => { setEditingLink(null); setLinkForm(emptyLink); setLinkModal(true); };
  const openEditLink = item => { setEditingLink(item.id); setLinkForm({ ...item }); setLinkModal(true); };

  const openAddInv = () => { setEditingInv(null); setInvForm(emptyInv); setInvModal(true); };
  const openEditInv = item => { setEditingInv(item.id); setInvForm({ ...item }); setInvModal(true); };

  const openAddFund = () => { setEditingFund(null); setFundForm(emptyFund); setFundModal(true); };
  const openEditFund = item => {
    setEditingFund(item.id);
    setFundForm({
      ...item,
      amount: Math.abs(Number(item.amount) || 0),
      date: item.date || (item.createdAt ? item.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
    });
    setFundModal(true);
  };

  // --- LINK HANDLERS ---
  const handleSaveLink = async (forceSave = false) => {
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      if (!linkForm.title.trim() || !linkForm.url.trim()) { alert('Vui lòng nhập tên và URL!'); return; }
      if (!forceSave) {
        const dup = await checkDuplicateLinkAsync(linkForm.url, editingLink, { studyResources, resources, events });
        if (dup) {
          setDupWarning({
            creator: dup.creator,
            onConfirm: () => {
              setDupWarning(null);
              handleSaveLink(true);
            }
          });
          return;
        }
      }
      if (editingLink) {
        await fbDb.collection('resources').doc(editingLink).set(linkForm, { merge: true });
        try { playSound('success'); } catch (e) {}
        try { addNotification(`Đã cập nhật link: ${linkForm.title}`, 'success'); } catch (e) {}
      } else {
        const id = uid();
        await fbDb.collection('resources').doc(id).set({ ...linkForm, id, createdAt: new Date().toISOString() });
        try { playSound('success'); } catch (e) {}
        try { addNotification(`Đã thêm link mới: ${linkForm.title}`, 'success'); } catch (e) {}
      }
      setLinkModal(false);
      setEditingLink(null);
    } catch (err) {
      console.error('Lỗi lưu link:', err);
      alert('Lỗi lưu Firebase: ' + err.message);
    }
  };

  const handleDeleteLink = async () => {
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('resources').doc(confirmDelLink).delete();
      try { playSound('pop'); } catch (e) {}
      try { addNotification('Đã xóa link tài liệu', 'info'); } catch (e) {}
      setConfirmDelLink(null);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  // --- INVENTORY HANDLERS ---
  const handleSaveInv = async () => {
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      if (!invForm.name.trim()) { alert('Vui lòng nhập tên đồ vật!'); return; }
      if (editingInv) {
        await fbDb.collection('inventory').doc(editingInv).set(invForm, { merge: true });
        try { playSound('success'); } catch (e) {}
        try { addNotification(`Đã cập nhật vật dụng: ${invForm.name}`, 'success'); } catch (e) {}
      } else {
        const id = uid();
        await fbDb.collection('inventory').doc(id).set({ ...invForm, id, createdAt: new Date().toISOString() });
        try { playSound('success'); } catch (e) {}
        try { addNotification(`Đã thêm vật dụng: ${invForm.name}`, 'success'); } catch (e) {}
      }
      setInvModal(false);
      setEditingInv(null);
    } catch (err) {
      alert('Lỗi lưu vật dụng: ' + err.message);
    }
  };

  const handleDeleteInv = async () => {
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('inventory').doc(confirmDelInv).delete();
      try { playSound('pop'); } catch (e) {}
      try { addNotification('Đã xóa vật dụng', 'info'); } catch (e) {}
      setConfirmDelInv(null);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  // --- FUND HANDLERS ---
  const handleSaveFund = async e => {
    if (e && e.preventDefault) e.preventDefault();
    if (!fundForm.content.trim()) { alert('Vui lòng nhập nội dung thu/chi!'); return; }
    const numAmount = Number(fundForm.amount);
    if (!numAmount || numAmount <= 0) { alert('Vui lòng nhập số tiền hợp lệ (> 0)!'); return; }

    setFundSaving(true);
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      const finalAmount = fundForm.type === 'thu' ? Math.abs(numAmount) : -Math.abs(numAmount);
      const cleanFund = {
        date: fundForm.date || new Date().toISOString().slice(0, 10),
        ban: fundForm.ban || 'Quỹ CLB',
        content: fundForm.content.trim(),
        type: fundForm.type, // 'thu' | 'chi'
        amount: finalAmount,
        person: fundForm.person.trim(),
        note: (fundForm.note || '').trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingFund) {
        await fbDb.collection('club_funds').doc(editingFund).set(cleanFund, { merge: true });
        try { playSound('success'); } catch (err) {}
        try { addNotification(`✅ Đã cập nhật khoản ${cleanFund.type === 'thu' ? 'thu' : 'chi'}: ${cleanFund.content}`, 'success'); } catch (err) {}
      } else {
        const id = uid();
        await fbDb.collection('club_funds').doc(id).set({ ...cleanFund, id, createdAt: new Date().toISOString() });
        try { playSound('success'); } catch (err) {}
        try { addNotification(`✅ Đã ghi nhận khoản ${cleanFund.type === 'thu' ? 'thu' : 'chi'} mới: ${cleanFund.content}`, 'success'); } catch (err) {}
      }
      setFundModal(false);
      setEditingFund(null);
    } catch (err) {
      console.error('Lỗi lưu sổ quỹ:', err);
      alert('Lỗi lưu sổ quỹ: ' + err.message);
    } finally {
      setFundSaving(false);
    }
  };

  const handleDeleteFund = async () => {
    try {
      if (!fbDb) throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('club_funds').doc(confirmDelFund).delete();
      try { playSound('pop'); } catch (err) {}
      try { addNotification('Đã xóa bản ghi thu/chi thành công', 'info'); } catch (err) {}
      setConfirmDelFund(null);
    } catch (err) {
      alert('Lỗi xóa bản ghi: ' + err.message);
    }
  };

  // --- FILTERED DATA & CALCULATIONS ---
  let filteredResources = resources;
  if (filterBan) filteredResources = filteredResources.filter(r => r.ban === filterBan);
  if (filterType) filteredResources = filteredResources.filter(r => r.type === filterType);

  // Sổ quỹ filtering & metrics
  const displayFunds = useMemo(() => {
    let list = clubFunds || [];
    if (fundBanFilter && fundBanFilter !== 'Tất cả') {
      list = list.filter(f => f.ban === fundBanFilter);
    }
    if (fundSearch.trim()) {
      const q = fundSearch.trim().toLowerCase();
      list = list.filter(f =>
        (f.content || '').toLowerCase().includes(q) ||
        (f.person || '').toLowerCase().includes(q) ||
        (f.note || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [clubFunds, fundBanFilter, fundSearch]);

  const totalIncome = useMemo(() => {
    return displayFunds
      .filter(f => f.type === 'thu' || (Number(f.amount) > 0 && f.type !== 'chi'))
      .reduce((s, f) => s + Math.abs(Number(f.amount) || 0), 0);
  }, [displayFunds]);

  const totalExpense = useMemo(() => {
    return displayFunds
      .filter(f => f.type === 'chi' || Number(f.amount) < 0)
      .reduce((s, f) => s + Math.abs(Number(f.amount) || 0), 0);
  }, [displayFunds]);

  const totalBalance = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Icon name="folder-open" size={22} className="text-indigo-600 dark:text-indigo-400" />
            Tài Nguyên & Quỹ CLB
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kho link tài liệu, quản lý tài sản vật dụng và sổ theo dõi thu chi quỹ CLB & các ban
          </p>
        </div>

        {/* Action Button based on active tab */}
        {tab === 'links' && (
          <button onClick={openAddLink} className="btn-primary flex items-center gap-1.5 font-bold">
            <Icon name="plus" size={15} /> Thêm link tài liệu
          </button>
        )}
        {tab === 'inventory' && (
          <button onClick={openAddInv} className="btn-primary flex items-center gap-1.5 font-bold">
            <Icon name="plus" size={15} /> Thêm vật dụng
          </button>
        )}
        {tab === 'funds' && (
          <button onClick={openAddFund} className="btn-primary flex items-center gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700">
            <Icon name="plus-circle" size={16} /> + Thêm khoản thu/chi
          </button>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
        {[
          ['links', '🔗 Kho Link'],
          ['inventory', '📦 Vật Dụng'],
          ['funds', '💰 Sổ Quỹ CLB & Các Ban']
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tab === v
                ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: KHO LINK */}
      {/* ============================================================ */}
      {tab === 'links' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={filterBan}
              onChange={e => setFilterBan(e.target.value)}
              className="form-input text-xs w-auto py-1.5"
            >
              <option value="">Tất cả ban</option>
              {BANS.map(b => <option key={b}>{b}</option>)}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="form-input text-xs w-auto py-1.5"
            >
              <option value="">Tất cả loại</option>
              {LINK_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {(filterBan || filterType) && (
              <button
                onClick={() => { setFilterBan(''); setFilterType(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
              >
                <Icon name="x-circle" size={13} /> Xóa lọc
              </button>
            )}
          </div>

          {filteredResources.length === 0 && (
            <div className="card py-14 text-center">
              <Icon name="folder-open" size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Chưa có link tài liệu nào</p>
              <p className="text-xs text-slate-300 mt-1">Lưu trữ link Google Drive, Canva, Forms, Docs...</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredResources.map(r => {
              const cfg = LINK_TYPE_CFG[r.type] || LINK_TYPE_CFG['Biên bản & Hành chính'];
              return (
                <div key={r.id} className={`card p-4 fade-in border-l-4 ${cfg.border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${cfg.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon name={cfg.icon} size={18} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{r.title}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                        {r.url}
                      </a>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className={`status-badge text-[11px] ${cfg.bg} ${cfg.text}`} style={{ border: 'none' }}>{r.type}</span>
                        {r.ban && <span className="status-badge tag-gray text-[11px]">{r.ban}</span>}
                      </div>
                      {r.note && <p className="text-xs text-slate-400 mt-1 truncate">{r.note}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 justify-end">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-500">
                      <Icon name="external-link" size={14} />
                    </a>
                    <button onClick={() => openEditLink(r)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                      <Icon name="pencil" size={14} />
                    </button>
                    <button onClick={() => setConfirmDelLink(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-400">
                      <Icon name="trash-2" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: VẬT DỤNG */}
      {/* ============================================================ */}
      {tab === 'inventory' && (
        <div className="space-y-3">
          {inventory.length === 0 && (
            <div className="card py-14 text-center">
              <Icon name="box" size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Chưa có vật dụng nào</p>
              <p className="text-xs text-slate-300 mt-1">Quản lý loa, mic, standee, dây nguồn...</p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inventory.map(item => (
              <div key={item.id} className="card p-4 fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/40 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon name="box" size={18} className="text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.name}</p>
                        <span className={`status-badge text-xs ${item.status === 'Tốt' ? 'tag-green' : item.status === 'Hỏng/Mất phụ kiện' ? 'tag-red' : 'tag-yellow'}`}>
                          {item.status}
                        </span>
                        {item.quantity && <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">SL: {item.quantity}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
                        {item.keeper && <span className="flex items-center gap-1"><Icon name="user" size={11} />Người giữ: {item.keeper}</span>}
                        {item.location && <span className="flex items-center gap-1"><Icon name="map-pin" size={11} />{item.location}</span>}
                      </div>
                      {item.note && <p className="text-xs text-slate-400 mt-1 italic">{item.note}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEditInv(item)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                      <Icon name="pencil" size={14} />
                    </button>
                    <button onClick={() => setConfirmDelInv(item.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-400">
                      <Icon name="trash-2" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: SỔ QUỸ CLB & CÁC BAN */}
      {/* ============================================================ */}
      {tab === 'funds' && (
        <div className="space-y-4">
          {/* 3 Thẻ thống kê số liệu tự động tính toán */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Tổng quỹ hiện có */}
            <div className="card p-4 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/80 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/40 border border-indigo-100 dark:border-indigo-900 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Tổng quỹ hiện có
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <Icon name="wallet" size={16} />
                </div>
              </div>
              <p className={`text-2xl font-black ${totalBalance >= 0 ? 'text-indigo-950 dark:text-indigo-200' : 'text-rose-600 dark:text-rose-400'}`}>
                {fmtVND(totalBalance)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span>Số dư thực tế ({fundBanFilter})</span>
              </p>
            </div>

            {/* Card 2: Tổng đã thu (+) */}
            <div className="card p-4 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/40 border border-emerald-100 dark:border-emerald-900 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Tổng đã thu (+)
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <Icon name="trending-up" size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                +{fmtVND(totalIncome)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Thu quỹ, tài trợ, tiền phạt...
              </p>
            </div>

            {/* Card 3: Tổng đã chi (-) */}
            <div className="card p-4 bg-gradient-to-br from-rose-50/80 via-white to-amber-50/80 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/40 border border-rose-100 dark:border-rose-900 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Tổng đã chi (-)
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                  <Icon name="trending-down" size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                -{fmtVND(totalExpense)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Chi sự kiện, in ấn, đạo cụ...
              </p>
            </div>
          </div>

          {/* Controls: Search & Ban filter chips */}
          <div className="card p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Chips filter by Ban */}
              <div className="flex flex-wrap items-center gap-1.5">
                {['Tất cả', ...FUND_BANS].map(b => (
                  <button
                    key={b}
                    onClick={() => setFundBanFilter(b)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      fundBanFilter === b
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              {/* Search box */}
              <div className="relative w-full sm:w-64">
                <Icon name="search" size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={fundSearch}
                  onChange={e => setFundSearch(e.target.value)}
                  placeholder="Tìm nội dung, người phụ trách..."
                  className="form-input text-xs pl-8 py-1.5 w-full"
                />
              </div>
            </div>
          </div>

          {/* Table / List of Income & Expense */}
          {displayFunds.length === 0 ? (
            <div className="card py-14 text-center">
              <Icon name="book-open" size={42} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold">Chưa có giao dịch thu/chi nào</p>
              <p className="text-xs text-slate-400 mt-1">Bấm nút "+ Thêm khoản thu/chi" ở góc trên để ghi chép sổ quỹ.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-3.5">Ngày tháng</th>
                      <th className="py-3 px-3">Ban / Đơn vị</th>
                      <th className="py-3 px-3">Nội dung thu / chi</th>
                      <th className="py-3 px-3">Loại</th>
                      <th className="py-3 px-3 text-right">Số tiền</th>
                      <th className="py-3 px-3">Người phụ trách</th>
                      <th className="py-3 px-3.5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayFunds.map(fund => {
                      const isThu = fund.type === 'thu' || (Number(fund.amount) > 0 && fund.type !== 'chi');
                      const absAmount = Math.abs(Number(fund.amount) || 0);

                      return (
                        <tr key={fund.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Ngày tháng */}
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Icon name="calendar" size={12} className="text-slate-400" />
                              {fund.date || '—'}
                            </span>
                          </td>

                          {/* Ban */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              fund.ban === 'Quỹ CLB'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : fund.ban === 'Ban Nội Vụ'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                : fund.ban === 'Ban Sự Kiện'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : fund.ban === 'Ban Truyền Thông'
                                ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300'
                                : 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                            }`}>
                              {fund.ban || 'Quỹ CLB'}
                            </span>
                          </td>

                          {/* Nội dung */}
                          <td className="py-3 px-3 min-w-[200px]">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{fund.content || fund.name || '—'}</p>
                            {fund.note && (
                              <p className="text-[11px] text-slate-400 mt-0.5 italic">{fund.note}</p>
                            )}
                          </td>

                          {/* Loại */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isThu ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <Icon name="arrow-up-right" size={11} /> Thu (+)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <Icon name="arrow-down-left" size={11} /> Chi (-)
                              </span>
                            )}
                          </td>

                          {/* Số tiền */}
                          <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-black text-sm">
                            <span className={isThu ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                              {isThu ? `+${fmtVND(absAmount)}` : `-${fmtVND(absAmount)}`}
                            </span>
                          </td>

                          {/* Người phụ trách */}
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 text-xs">
                            {fund.person ? (
                              <span className="flex items-center gap-1">
                                <Icon name="user" size={12} className="text-slate-400" />
                                {fund.person}
                              </span>
                            ) : '—'}
                          </td>

                          {/* Thao tác */}
                          <td className="py-3 px-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditFund(fund)}
                                title="Chỉnh sửa khoản thu/chi"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                              >
                                <Icon name="pencil" size={14} />
                              </button>
                              <button
                                onClick={() => setConfirmDelFund(fund.id)}
                                title="Xóa khoản thu/chi"
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Icon name="trash-2" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: THÊM / SỬA LINK */}
      {/* ============================================================ */}
      <Modal open={linkModal} onClose={() => { setLinkModal(false); setEditingLink(null); }} title={editingLink ? 'Chỉnh Sửa Link Tài Liệu' : 'Thêm Link Tài Liệu Mới'}>
        <div className="space-y-4">
          <div>
            <label className="form-label">Tên tài liệu <span className="text-red-500">*</span></label>
            <input value={linkForm.title} onChange={e => setLinkForm(p => ({ ...p, title: e.target.value }))} className="form-input" placeholder="VD: Kế hoạch Talkshow tháng 11..." />
          </div>
          <div>
            <label className="form-label">Đường dẫn (URL) <span className="text-red-500">*</span></label>
            <input value={linkForm.url} onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))} className="form-input" placeholder="https://docs.google.com/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Loại tài liệu</label>
              <select value={linkForm.type} onChange={e => setLinkForm(p => ({ ...p, type: e.target.value }))} className="form-input">
                {LINK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Ban phụ trách</label>
              <select value={linkForm.ban} onChange={e => setLinkForm(p => ({ ...p, ban: e.target.value }))} className="form-input">
                <option value="">Chọn ban...</option>
                {BANS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Ghi chú</label>
            <input value={linkForm.note} onChange={e => setLinkForm(p => ({ ...p, note: e.target.value }))} className="form-input" placeholder="Mô tả ngắn về tài liệu..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setLinkModal(false); setEditingLink(null); }} className="btn-secondary flex-1">Hủy</button>
            <button onClick={() => handleSaveLink(false)} className="btn-primary flex-1 font-bold">{editingLink ? 'Lưu thay đổi' : 'Thêm link'}</button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: THÊM / SỬA VẬT DỤNG */}
      {/* ============================================================ */}
      <Modal open={invModal} onClose={() => { setInvModal(false); setEditingInv(null); }} title={editingInv ? 'Chỉnh Sửa Vật Dụng' : 'Thêm Vật Dụng Mới'}>
        <div className="space-y-4">
          <div>
            <label className="form-label">Tên đồ vật <span className="text-red-500">*</span></label>
            <input value={invForm.name} onChange={e => setInvForm(p => ({ ...p, name: e.target.value }))} className="form-input" placeholder="VD: Loa di động JBL, Standee CLB..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Số lượng</label>
              <input type="number" min="1" value={invForm.quantity} onChange={e => setInvForm(p => ({ ...p, quantity: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="form-label">Tình trạng</label>
              <select value={invForm.status} onChange={e => setInvForm(p => ({ ...p, status: e.target.value }))} className="form-input">
                {INVENTORY_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Người đang giữ</label>
              <input value={invForm.keeper} onChange={e => setInvForm(p => ({ ...p, keeper: e.target.value }))} className="form-input" placeholder="Tên người giữ" />
            </div>
            <div>
              <label className="form-label">Vị trí lưu trữ</label>
              <input value={invForm.location} onChange={e => setInvForm(p => ({ ...p, location: e.target.value }))} className="form-input" placeholder="Tủ phòng BCN, nhà..." />
            </div>
          </div>
          <div>
            <label className="form-label">Ghi chú</label>
            <textarea value={invForm.note} onChange={e => setInvForm(p => ({ ...p, note: e.target.value }))} className="form-input resize-none min-h-[60px]" placeholder="Thêm ghi chú..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setInvModal(false); setEditingInv(null); }} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSaveInv} className="btn-primary flex-1 font-bold">{editingInv ? 'Lưu thay đổi' : 'Thêm vật dụng'}</button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: THÊM / SỬA KHOẢN THU / CHI SỔ QUỸ */}
      {/* ============================================================ */}
      <Modal open={fundModal} onClose={() => { setFundModal(false); setEditingFund(null); }} title={editingFund ? 'Chỉnh Sửa Khoản Thu / Chi' : 'Ghi Nhận Khoản Thu / Chi Mới'}>
        <form onSubmit={handleSaveFund} className="space-y-4">
          {/* Segmented Button: Thu vs Chi */}
          <div>
            <label className="form-label block mb-1.5">Loại giao dịch <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setFundForm(p => ({ ...p, type: 'thu' }))}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  fundForm.type === 'thu'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Icon name="arrow-up-right" size={14} />
                + Thu vào quỹ
              </button>
              <button
                type="button"
                onClick={() => setFundForm(p => ({ ...p, type: 'chi' }))}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  fundForm.type === 'chi'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Icon name="arrow-down-left" size={14} />
                - Chi từ quỹ
              </button>
            </div>
          </div>

          {/* Số tiền */}
          <div>
            <label className="form-label">
              Số tiền (VNĐ) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={fundForm.amount}
              onChange={e => setFundForm(p => ({ ...p, amount: e.target.value }))}
              className="form-input text-base font-mono font-bold"
              placeholder="VD: 500000"
              required
            />
            {fundForm.amount && Number(fundForm.amount) > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                Bằng chữ: <strong>{fmtVND(fundForm.amount)}</strong>
              </p>
            )}
          </div>

          {/* Nội dung */}
          <div>
            <label className="form-label">
              Nội dung thu / chi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fundForm.content}
              onChange={e => setFundForm(p => ({ ...p, content: e.target.value }))}
              className="form-input font-medium"
              placeholder="VD: Thu quỹ thành viên kỳ I, Chi mua nước Workshop..."
              required
            />
          </div>

          {/* Ban & Ngày tháng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Ban / Quỹ thụ hưởng</label>
              <select
                value={fundForm.ban}
                onChange={e => setFundForm(p => ({ ...p, ban: e.target.value }))}
                className="form-input font-bold"
              >
                {FUND_BANS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Ngày thực hiện</label>
              <input
                type="date"
                value={fundForm.date}
                onChange={e => setFundForm(p => ({ ...p, date: e.target.value }))}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Người phụ trách */}
          <div>
            <label className="form-label">Người phụ trách / Người nộp / Người nhận</label>
            <input
              type="text"
              value={fundForm.person}
              onChange={e => setFundForm(p => ({ ...p, person: e.target.value }))}
              className="form-input"
              placeholder="VD: Trần Thị Thu Trang (Thủ quỹ)"
            />
          </div>

          {/* Ghi chú */}
          <div>
            <label className="form-label">Ghi chú / Link hóa đơn, chứng từ</label>
            <textarea
              value={fundForm.note}
              onChange={e => setFundForm(p => ({ ...p, note: e.target.value }))}
              className="form-input resize-none min-h-[60px]"
              placeholder="VD: Link drive hóa đơn mua hàng, ghi chú chi tiết..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setFundModal(false); setEditingFund(null); }}
              className="btn-secondary flex-1"
              disabled={fundSaving}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 font-bold"
              disabled={fundSaving}
            >
              {fundSaving ? 'Đang lưu...' : (editingFund ? '💾 Lưu thay đổi' : '💾 Lưu khoản ' + (fundForm.type === 'thu' ? 'thu' : 'chi'))}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deletion Dialogs */}
      <ConfirmDialog open={!!confirmDelLink} onClose={() => setConfirmDelLink(null)} onConfirm={handleDeleteLink} message="Bạn có chắc muốn xóa link tài liệu này?" />
      <ConfirmDialog open={!!confirmDelInv} onClose={() => setConfirmDelInv(null)} onConfirm={handleDeleteInv} message="Bạn có chắc muốn xóa vật dụng này?" />
      <ConfirmDialog open={!!confirmDelFund} onClose={() => setConfirmDelFund(null)} onConfirm={handleDeleteFund} message="Bạn có chắc muốn xóa bản ghi thu/chi này khỏi sổ quỹ?" />
      <DuplicateLinkDialog open={!!dupWarning} creator={dupWarning?.creator} onCancel={() => setDupWarning(null)} onConfirm={dupWarning?.onConfirm} />
    </div>
  );
}


// ============================================================
// GÓC HỌC TẬP NVC (STUDY HUB MODULE)
// ============================================================
const STUDY_BLOCKS = [
  'Tất cả',
  'Đại cương',
  'Cơ sở ngành',
  'Chuyên ngành Dược'
];

const STUDY_CATEGORIES = [
  'Tất cả',
  'Đề thi & Đáp án',
  'Slide bài giảng',
  'Giáo trình/Sách',
  'Tóm tắt lý thuyết'
];

function StudyHubPage(){
  const{studyResources,setStudyResources,addNotification,playSound,adminMode,userIdentity,resources,events}=useContext(AppCtx);
  const[dupWarning,setDupWarning]=useState(null);
  const[selectedBlock,setSelectedBlock]=useState('Tất cả');
  const[selectedCat,setSelectedCat]=useState('Tất cả');
  const[searchQuery,setSearchQuery]=useState('');
  const[modalOpen,setModalOpen]=useState(false);
  const[editingId,setEditingId]=useState(null);
  const[confirmDeleteId,setConfirmDeleteId]=useState(null);
  const[copiedId,setCopiedId]=useState(null);

  const emptyForm={
    title:'',
    block:'Cơ sở ngành',
    category:'Đề thi & Đáp án',
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
      block:item.block||'Cơ sở ngành',
      category:item.category||'Đề thi & Đáp án',
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
      alert('Vui lòng nhập tên tài liệu / môn học!');
      return;
    }
    if(!formData.url.trim()){
      alert('Vui lòng nhập link tài liệu (Drive/Docs/Sheets)!');
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
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      if(editingId){
        await fbDb.collection('study_resources').doc(editingId).set({
          ...formData,
          updatedAt:new Date().toISOString()
        },{merge:true});
        try{playSound('success');}catch(e){}
        try{addNotification(`Đã cập nhật tài liệu: ${formData.title}`,'success');}catch(e){}
      }else{
        const id=uid();
        await fbDb.collection('study_resources').doc(id).set({
          ...formData,
          id,
          createdAt:new Date().toISOString()
        });
        try{playSound('success');}catch(e){}
        try{addNotification(`Đã đóng góp tài liệu mới: ${formData.title}`,'success');}catch(e){}
      }
      setModalOpen(false);
      setEditingId(null);
    }catch(err){
      console.error('Lỗi lưu tài liệu học tập:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const handleDelete=async()=>{
    if(!confirmDeleteId)return;
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      await fbDb.collection('study_resources').doc(confirmDeleteId).delete();
      try{playSound('pop');}catch(e){}
      try{addNotification('Đã xóa tài liệu khỏi Góc Học Tập','info');}catch(e){}
      setConfirmDeleteId(null);
    }catch(err){
      console.error('Lỗi xóa tài liệu:',err);
      alert('Lỗi lưu Firebase: '+err.message);
    }
  };

  const handleTogglePin=async(item)=>{
    try{
      if(!fbDb)throw new Error('Firebase chưa kết nối!');
      const newPinned=!item.pinned;
      await fbDb.collection('study_resources').doc(item.id).set({
        pinned:newPinned
      },{merge:true});
      try{playSound('pop');}catch(e){}
      try{addNotification(newPinned?`Đã ghim tài liệu trọng tâm: ${item.title}`:`Đã bỏ ghim: ${item.title}`,'info');}catch(e){}
    }catch(err){
      console.error('Lỗi ghim tài liệu:',err);
      alert('Lỗi lưu Firebase: '+err.message);
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
      try{addNotification('Đã sao chép link tài liệu vào bộ nhớ tạm!','info');}catch(e){}
      setTimeout(()=>setCopiedId(null),2000);
    }catch(err){
      console.warn('Lỗi copy clipboard:',err);
    }
  };

  // Filtered resources
  const filteredList=useMemo(()=>{
    return(studyResources||[]).filter(item=>{
      const matchBlock=selectedBlock==='Tất cả'||item.block===selectedBlock;
      const matchCat=selectedCat==='Tất cả'||item.category===selectedCat;
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
      case 'Đề thi & Đáp án':return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      case 'Slide bài giảng':return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
      case 'Giáo trình/Sách':return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'Tóm tắt lý thuyết':return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      default:return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getBlockBadge=(block)=>{
    switch(block){
      case 'Đại cương':return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300';
      case 'Cơ sở ngành':return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
      case 'Chuyên ngành Dược':return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300';
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
                <Icon name="flame" size={12}/> Hot ôn thi
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
                title={item.pinned?'Bỏ ghim tài liệu':'Ghim tài liệu hot ôn thi'}
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
                title="Chỉnh sửa tài liệu"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Icon name="pencil" size={15}/>
              </button>
            )}
            {adminMode && (
              <button
                onClick={()=>setConfirmDeleteId(item.id)}
                title="Xóa tài liệu"
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
          <span className="truncate font-medium">{item.contributor||'Thành viên NVC'}</span>
          {item.createdAt&&(
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
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
          <span>Mở Drive</span>
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
          <span>{copiedId===item.id?"Đã chép":"Sao chép link"}</span>
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
              <Icon name="graduation-cap" size={14}/> Góc Học Tập & Tri Thức NVC
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Kho Đề Thi, Bài Giảng & Tài Liệu Dược</h1>
            <p className="text-xs sm:text-sm text-orange-100 mt-1 max-w-xl leading-relaxed">
              Ngân hàng tài liệu ôn thi môn học, đề thi có đáp án, tóm tắt lý thuyết và slide bài giảng dành riêng cho các thế hệ thành viên NewVision HUP.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-white text-orange-600 hover:bg-orange-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition active:scale-95 flex-shrink-0"
          >
            <Icon name="plus" size={17} className="text-orange-600"/>
            <span>Đóng góp tài liệu</span>
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
            placeholder="Tìm theo tên môn học, người chia sẻ, ghi chú tài liệu (VD: Dược lý, Hóa Dược, Giải phẫu...)..."
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

        {/* Khối / Khóa Filter Chips */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Icon name="layers" size={13}/> Khối / Khóa:
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

        {/* Phân loại tài liệu Filter Chips */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Icon name="filter" size={13}/> Phân loại tài liệu:
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

      {/* Pinned Section: Tài Liệu Ôn Thi Trọng Tâm */}
      {pinnedList.length>0&&(
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs">
                <Icon name="flame" size={16}/>
              </span>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Tài Liệu Ôn Thi Trọng Tâm (Hot)
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

      {/* Regular Section: Tất cả tài liệu */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-xs">
              <Icon name="folder-open" size={15}/>
            </span>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Tất cả tài liệu môn học ({regularList.length})
            </h2>
          </div>
        </div>

        {regularList.length===0?(
          <div className="card p-10 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
              <Icon name="book-open" size={28}/>
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-base mb-1">
              {searchQuery||selectedBlock!=='Tất cả'||selectedCat!=='Tất cả'?'Không có tài liệu nào phù hợp bộ lọc':'Chưa có tài liệu nào'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Hãy trở thành người đầu tiên đóng góp đề thi, slide hoặc tài liệu học tập bổ ích cho các thế hệ thành viên NVC!
            </p>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-xs sm:text-sm py-2 px-4 rounded-xl">
              <Icon name="plus" size={16}/> Đóng góp tài liệu mới
            </button>
          </div>
        ):(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularList.map(renderCard)}
          </div>
        )}
      </section>

      {/* Modal Form: Thêm mới / Chỉnh sửa */}
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
                    {editingId?'Chỉnh sửa tài liệu học tập':'Đóng góp tài liệu học tập mới'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Chia sẻ tri thức Dược Hà Nội cho cộng đồng NewVision HUP</p>
                </div>
              </div>
              <button onClick={()=>setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                <Icon name="x" size={18}/>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="form-label">Tên tài liệu / Môn học <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="VD: Tổng hợp Đề thi Dược lý 1 K78-K79 có giải thích chi tiết"
                  value={formData.title}
                  onChange={e=>setFormData({...formData,title:e.target.value})}
                  className="form-input text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Khối / Khóa đào tạo <span className="text-red-500">*</span></label>
                  <select
                    value={formData.block}
                    onChange={e=>setFormData({...formData,block:e.target.value})}
                    className="form-input text-sm"
                  >
                    <option value="Đại cương">Đại cương (Năm 1)</option>
                    <option value="Cơ sở ngành">Cơ sở ngành (Năm 2 - 3)</option>
                    <option value="Chuyên ngành Dược">Chuyên ngành Dược (Năm 4 - 5)</option>
                    <option value="K79">Khóa K79</option>
                    <option value="K80">Khóa K80</option>
                    <option value="K81">Khóa K81</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Phân loại tài liệu <span className="text-red-500">*</span></label>
                  <select
                    value={formData.category}
                    onChange={e=>setFormData({...formData,category:e.target.value})}
                    className="form-input text-sm"
                  >
                    <option value="Đề thi & Đáp án">Đề thi & Đáp án</option>
                    <option value="Slide bài giảng">Slide bài giảng</option>
                    <option value="Giáo trình/Sách">Giáo trình / Sách tham khảo</option>
                    <option value="Tóm tắt lý thuyết">Tóm tắt lý thuyết / Mindmap</option>
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
                <p className="text-[11px] text-slate-400 mt-1">Đảm bảo link Drive đã mở quyền "Bất kỳ ai có đường liên kết đều xem được".</p>
              </div>

              <div>
                <label className="form-label">Người đóng góp (Tên / Lớp / Khóa)</label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn A - Lớp A2K78"
                  value={formData.contributor}
                  onChange={e=>setFormData({...formData,contributor:e.target.value})}
                  className="form-input text-sm"
                />
              </div>

              <div>
                <label className="form-label">Ghi chú ôn thi / Hướng dẫn sử dụng</label>
                <textarea
                  rows="2"
                  placeholder="VD: Tài liệu gồm 5 đề thi các năm gần đây, trọng tâm phần kháng sinh..."
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
                  Ghim nổi bật vào mục "Tài liệu ôn thi trọng tâm (Hot)"
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={()=>setModalOpen(false)}
                  className="btn-secondary text-xs sm:text-sm py-2 px-4 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs sm:text-sm py-2.5 px-5 rounded-xl font-semibold flex items-center gap-2 shadow-md"
                >
                  <Icon name="check" size={16}/>
                  <span>{editingId?'Lưu thay đổi':'Đăng tài liệu'}</span>
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
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">Xác nhận xóa tài liệu?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Tài liệu này sẽ bị xóa vĩnh viễn khỏi Cloud Firestore của toàn bộ câu lạc bộ.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={()=>setConfirmDeleteId(null)} className="btn-secondary text-xs sm:text-sm py-2 px-4 rounded-xl flex-1">
                  Không xóa
                </button>
                <button onClick={handleDelete} className="btn-danger text-xs sm:text-sm py-2 px-4 rounded-xl flex-1">
                  Xác nhận xóa
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
        <div><h1 className="text-xl font-bold text-slate-800">Lịch Sử Hoạt Động</h1><p className="text-xs text-slate-500 mt-0.5">{unreadCount} thông báo chưa đọc</p></div>
        {unreadCount>0&&<button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"><Icon name="check-check" size={15}/>Đánh dấu tất cả</button>}
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[['all','Tất cả'],['unread','Chưa đọc']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter===v?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>{l}{v==='unread'&&unreadCount>0?` (${unreadCount})`:''}</button>
        ))}
      </div>
      {filtered.length===0?(
        <div className="card py-20 text-center">
          <Icon name="bell-off" size={48} className="text-slate-200 mx-auto mb-4"/>
          <p className="text-slate-400 font-medium text-lg">Không có thông báo</p>
          <p className="text-sm text-slate-300 mt-1">{filter==='unread'?'Bạn đã đọc tất cả!':'Chưa có hoạt động nào'}</p>
        </div>
      ):(
        <div className="card overflow-hidden divide-y divide-slate-50">
          {filtered.map(n=>(
            <div key={n.id} className={`flex gap-3 p-4 hover:bg-slate-50 transition ${!n.read?'bg-blue-50/40':''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[n.type]||typeColors.info}`}><Icon name={typeIcons[n.type]||'info'} size={17}/></div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!n.read?'font-semibold text-slate-800':'text-slate-600'}`}>{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{relTime(n.timestamp)} · {new Date(n.timestamp).toLocaleString('vi-VN')}</p>
              </div>
              {!n.read&&<div className="flex items-start gap-2 flex-shrink-0"><div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"/><button onClick={()=>markRead(n.id)} className="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap">Đánh dấu đã đọc</button></div>}
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
    {label:'Tạo sự kiện mới',icon:'calendar-plus',color:'bg-blue-500 text-white',tab:'events'},
    {label:'Ghi nhận vấn đề',icon:'file-plus',color:'bg-amber-500 text-white',tab:'decisions'},
    {label:'Góc học tập NVC',icon:'book-open',color:'bg-emerald-500 text-white',tab:'study'},
    {label:'Thêm link tài liệu',icon:'link',color:'bg-purple-500 text-white',tab:'resources'},
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
  {id:'dashboard',label:'Tổng quan',icon:'layout-dashboard'},
  {id:'events',label:'Sự kiện',icon:'calendar-days'},
  {id:'study',label:'Góc học tập',icon:'book-open'},
  {id:'members',label:'Thành viên',icon:'users'},
  {id:'penalties',label:'Thưởng & Phạt',icon:'scale'},
  {id:'decisions',label:'Quyết định',icon:'file-check-2'},
  {id:'resources',label:'Tài nguyên & Quỹ',icon:'folder-open',isLocked:true},
  {id:'bcn',label:'Phòng BCN',icon:'shield',isBcn:true,isLocked:true},
];

const MOBILE_NAV_ITEMS=[
  {id:'dashboard',label:'Tổng quan',icon:'layout-dashboard'},
  {id:'events',label:'Sự kiện',icon:'calendar-days'},
  {id:'study',label:'Học tập',icon:'book-open'},
  {id:'members',label:'Thành viên',icon:'users'},
  {id:'penalties',label:'Thưởng phạt',icon:'scale'},
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
                <span className="hidden sm:block text-[10px] text-slate-400 leading-none">CLB Kỹ năng mềm – ĐH Dược HN</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* User Identity Selector */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-medium flex items-center gap-1 flex-shrink-0">
                <Icon name="user" size={13}/> Tôi là:
              </span>
              <select
                value={userIdentity}
                onChange={e=>{
                  const val=e.target.value;
                  setUserIdentity(val);
                  localStorage.setItem('nv_user_identity',val);
                  if(val)try{addNotification(`👤 Đã nhận diện danh tính: ${val}`,'info');}catch(err){}
                }}
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="">-- Chọn tên bạn --</option>
                {members.map(m=>(
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Gacha Daily Button */}
            <button
              onClick={()=>setGachaOpen(true)}
              title="Gieo quẻ / Bốc quẻ huyền học hôm nay"
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-xs shadow-xs hover:brightness-105 transition active:scale-95 flex-shrink-0"
            >
              <span>🎴</span>
              <span className="hidden sm:inline">Quẻ Hôm Nay</span>
            </button>

            {/* Admin Mode Pill */}
            {adminMode ? (
              <button
                onClick={()=>{
                  setAdminMode(false);
                  try{addNotification('Đã đăng xuất chế độ Quản trị BCN','info');}catch(err){}
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition"
                title="Bấm để đăng xuất chế độ Quản trị BCN"
              >
                <span>👑</span>
                <span className="hidden sm:inline">Quản trị [Đăng xuất]</span>
              </button>
            ) : (
              <button
                onClick={()=>setAdminLoginOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition"
                title="Đăng nhập Quản trị BCN"
              >
                <Icon name="key" size={13}/>
                <span className="hidden sm:inline">BCN</span>
              </button>
            )}

            {/* Realtime Status Pill */}
            <button
              onClick={()=>setSettingsOpen(true)}
              title={
                cloudStatus==='connected' ? `Firebase Firestore Realtime đang hoạt động (Đồng bộ: ${lastSynced ? lastSynced.toLocaleTimeString('vi-VN') : 'vừa xong'})` :
                cloudStatus==='syncing' ? 'Đang đồng bộ dữ liệu lên Firebase Cloud...' :
                'Chế độ Ngoại tuyến / Lưu cục bộ LocalStorage (Bấm để mở cài đặt)'
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
                {cloudStatus==='connected' ? 'Cloud Live' : cloudStatus==='syncing' ? 'Đang sync...' : 'Offline'}
              </span>
            </button>

            <button onClick={()=>setCmdOpen(true)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition text-slate-500 text-sm border border-slate-200 bg-white">
              <Icon name="search" size={14}/><span className="text-xs text-slate-400">Tìm kiếm...</span><kbd className="text-[10px] bg-slate-100 text-slate-300 rounded px-1">Ctrl K</kbd>
            </button>
            <button onClick={()=>setCmdOpen(true)} className="sm:hidden p-2 rounded-xl hover:bg-slate-100 transition"><Icon name="search" size={20} className="text-slate-600"/></button>
            <button onClick={()=>setSoundEnabled(o=>!o)} title={soundEnabled?'Tắt âm thanh':'Bật âm thanh'} className="p-2 rounded-xl hover:bg-slate-100 transition">
              <Icon name={soundEnabled?'volume-2':'volume-x'} size={18} className="text-slate-500"/>
            </button>
            <button onClick={()=>setDarkMode(o=>!o)} title="Chuyển sáng/tối" className="p-2 rounded-xl hover:bg-slate-100 transition">
              <Icon name={darkMode?'sun':'moon'} size={18} className="text-slate-500"/>
            </button>
            <button onClick={()=>setSettingsOpen(true)} title="Cài đặt giao diện & hệ thống" className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-600 hover:text-slate-800">
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
                  {bcnUnlocked?'MỞ':'PIN'}
                </span>
              )}
              {item.isLocked && !adminMode && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Icon name="lock" size={10}/>Khóa
                </span>
              )}
            </button>
          ))}
          <button onClick={()=>setActiveTab('notifications')} className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 w-full text-left ${activeTab==='notifications'?'active':''}`}>
            <Icon name="bell" size={18} className={activeTab==='notifications'?'text-primary':'text-slate-400'}/>
            <span>Thông báo</span>
            {unreadCount>0&&<span className="ml-auto bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none">{unreadCount}</span>}
          </button>
          <div className="mt-auto pt-4 border-t border-slate-100 px-2">
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 theme-brand-bg" style={{background:'var(--brand-gradient)'}}><Icon name="eye" size={10} className="text-white"/></div>
              <div><p className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">NewVision HUP v2.5</p><p>ĐH Dược HN • Cloud Firestore ✓</p></div>
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
                  <div><span className="font-extrabold text-slate-800">NewVision HUP</span><p className="text-[10px] text-slate-400">CLB Kỹ năng mềm – ĐH Dược HN</p></div>
                </div>
                <button onClick={()=>setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><Icon name="x" size={18} className="text-slate-500"/></button>
              </div>

              {/* Mobile Identity Selector */}
              <div className="mb-2 px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">👤 Bạn là:</span>
                <select
                  value={userIdentity}
                  onChange={e=>{
                    const val=e.target.value;
                    setUserIdentity(val);
                    localStorage.setItem('nv_user_identity',val);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1 font-semibold text-slate-700"
                >
                  <option value="">-- Chọn tên bạn --</option>
                  {members.map(m=>(
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              {[...NAV_ITEMS,{id:'notifications',label:'Thông báo',icon:'bell'}].map(item=>(
                <button key={item.id} onClick={()=>{setActiveTab(item.id);setSidebarOpen(false)}} className={`sidebar-link flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left ${activeTab===item.id?'active':'text-slate-600'}`}>
                  <div className="flex items-center gap-3">
                    <Icon name={item.icon} size={18} className={activeTab===item.id?'text-primary':item.isBcn?'text-amber-500':'text-slate-400'}/>
                    <span className={item.isBcn?'font-bold text-amber-700':''}>{item.label}</span>
                  </div>
                  {item.isBcn&&<span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">{bcnUnlocked?'MỞ':'PIN'}</span>}
                  {item.isLocked&&!adminMode&&<span className="text-[10px] text-slate-400 font-bold">Khóa</span>}
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
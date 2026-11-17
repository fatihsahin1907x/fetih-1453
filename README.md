# Fetih 1453: TikTok canlı yayın oyunu

İzleyiciler yorum yazıp hediye atarak kale kapısına saldırır.

| İzleyici ne yapar | Oyunda ne olur |
|---|---|
| "SALDIR" yazar | Adıyla bir yeniçeri gelir ve kapıya vurur |
| 1-9 jetonluk hediye (Gül vb.) | Okçu gelir |
| 10-99 jetonluk hediye | Top arabası gelir |
| 100-999 jetonluk hediye | Koçbaşı gelir |
| 1000+ jetonluk hediye (Aslan vb.) | SULTAN ORDUSU gelir: koçbaşı, toplar, askerler ve büyük hasar |
| Beğeni | Kapıya küçük hasar verir |
| Takip / paylaşım | Bayraklı bir asker gelir |

Kapı düşünce en çok hasar veren 3 kişi ekranda gösterilir ve daha sağlam yeni bir kale gelir.

## Dosyalar
- `server.js`: TikTok yayınını dinler ve olayları oyuna iletir
- `index.html`: oyun ekranı
- `package.json`: gerekli paketler

## 1. Sunucuya yükleme (Render, ücretsiz)
1. github.com'da hesap aç, **New repository** ile `fetih-1453` adlı **Public** bir repo oluştur.
2. Repoda **Add file → Upload files** seç, bu 4 dosyayı (`server.js`, `index.html`, `package.json`, `README.md`) yükle ve **Commit changes** de.
3. render.com'a GitHub hesabınla gir. **New → Web Service** seç ve `fetih-1453` reposunu seç.
4. Ayarlar:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
5. **Deploy** de. Birkaç dakika sonra `https://fetih-1453-xxxx.onrender.com` gibi bir adres verir. Oyunun adresi bu.

Not: Ücretsiz Render sunucusu kullanılmayınca uyur. İlk açılışta 30-60 saniye beklemek normal. Oyun sayfası açık kaldığı sürece sunucu uyanık kalır.

## 2. Yayında kullanma (telefon)
1. Oyunun adresini telefonda Safari veya Chrome ile aç.
2. TikTok kullanıcı adını yaz ve **Bağlan**'a bas.
3. **Test olayı gönder**'e bas. Ekranda `test_` isimli askerler görünürse sunucu çalışıyor demektir.
4. **Oyunu başlat** ile paneli kapat. Paneli tekrar açmak için sağ üst köşeye dokun.
5. TikTok'ta **Canlı → Mobil oyun (ekran paylaşımı)** ile yayını başlat ve tarayıcıya geri dön.
6. Yayın açılınca oyun 15 saniye içinde kendiliğinden bağlanır. Panelde "Bağlı" yazar.

İpuçları:
- Yayından önce telefonu **Rahatsız Etmeyin** moduna al, yoksa bildirimler yayında görünür.
- iPhone'da Safari'de **Paylaş → Ana Ekrana Ekle** dersen oyun tam ekran açılır.
- Az izleyicin varsa paneldeki "Kale dayanıklılığı" ayarını **Kolay** yap.

## 2b. Bilgisayardan yayın (isteğe bağlı)
TikTok LIVE Studio'da veya OBS'te **Tarayıcı kaynağı** ekle, oyunun adresini yaz ve boyutu 1080 x 1920 yap. Bilgisayarda çalıştırmak için `npm install` ve ardından `npm start` yeterli; adres `http://localhost:3000`.

## Sorun giderme
- **"Canlı yayında görünmüyor":** Yayın açık değildir ya da kullanıcı adı yanlıştır. Oyun her 15 saniyede bir tekrar dener.
- **Bağlanıp kopuyor veya hiç bağlanmıyor:** Yayın bağlantısı ücretsiz bir imza servisi (Euler Stream) üzerinden kuruluyor ve bu servisin günlük sınırı var. eulerstream.com'dan ücretsiz anahtar alıp Render'da **Environment** bölümüne `SIGN_API_KEY` adıyla ekle.
- İstersen `TIKTOK_USERNAME` ortam değişkeni eklersen sunucu açılınca o hesaba kendiliğinden bağlanır.

Bu bağlantı aracı (tiktok-live-connector) TikTok'un resmi aracı değildir. Yayını sadece okur ama TikTok değişiklik yaparsa geçici olarak bozulabilir; o zaman paketi güncellemek gerekir.

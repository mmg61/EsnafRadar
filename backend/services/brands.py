import re
from typing import Optional

# Türkiye ve Global Kurumsal Zincir / Franchise Resmi Web Adresleri Sözlüğü
KNOWN_BRAND_WEBSITES: dict[str, str] = {
    # Süpermarket & İndirim Marketleri
    "a101": "https://www.a101.com.tr",
    "a 101": "https://www.a101.com.tr",
    "bim": "https://www.bim.com.tr",
    "şok": "https://www.sokmarket.com.tr",
    "sok market": "https://www.sokmarket.com.tr",
    "migros": "https://www.migros.com.tr",
    "macrocenter": "https://www.macrocenter.com.tr",
    "carrefoursa": "https://www.carrefoursa.com",
    "carrefour": "https://www.carrefoursa.com",
    "file market": "https://www.file.com.tr",
    "tarım kredi": "https://www.tkkmarket.com.tr",
    "koop market": "https://www.tkkmarket.com.tr",
    "hakmar": "https://www.hakmarexpress.com.tr",
    "happy center": "https://www.happycenter.com.tr",
    "kim market": "https://www.kimmarket.com",
    "mopaş": "https://www.mopas.com.tr",
    "mopas": "https://www.mopas.com.tr",
    "onur market": "https://www.onurmarket.com",
    "çağrı market": "https://www.cagrimarket.com.tr",
    "biçen market": "https://www.bicen.com.tr",
    "özkuruşlar": "https://www.ozkuruslar.com.tr",
    "seç market": "https://www.secmarket.com.tr",
    "metro market": "https://www.metro-tr.com",
    "bizim toptan": "https://www.bizimtoptan.com.tr",
    "yunus market": "https://www.yunusmarket.com.tr",
    "altunbilekler": "https://www.altunbilekler.com.tr",
    "çağdaş market": "https://www.cagdasmarketler.com",
    "tahtakale spot": "https://www.tahtakalespot.com",

    # Kozmetik & Kişisel Bakım
    "gratis": "https://www.gratis.com",
    "watsons": "https://www.watsons.com.tr",
    "rossmann": "https://www.rossmann.com.tr",
    "eve shop": "https://www.eveshop.com.tr",
    "sephora": "https://www.sephora.com.tr",
    "flormar": "https://www.flormar.com.tr",
    "golden rose": "https://www.goldenrose.com.tr",
    "yves rocher": "https://www.yvesrocher.com.tr",
    "the body shop": "https://www.thebodyshop.com.tr",
    "kiko milano": "https://www.kikomilano.com.tr",
    "bargello": "https://www.bargello.com.tr",
    "mad parfüm": "https://www.madparfum.com",
    "loris parfüm": "https://www.lorisparfum.com",

    # Kahve, Pastane & Yeme-İçme Zincirleri
    "starbucks": "https://www.starbucks.com.tr",
    "kahve dünyası": "https://www.kahvedunyasi.com",
    "espressolab": "https://www.espressolab.com",
    "tchibo": "https://www.tchibo.com.tr",
    "gloria jean": "https://www.gloriajeans.com.tr",
    "caffe nero": "https://www.caffenero.com/tr",
    "caribou coffee": "https://www.cariboucoffee.com.tr",
    "coffy": "https://www.coffy.com.tr",
    "arabica coffee": "https://www.arabicacoffeehouse.com",
    "mackbear": "https://www.mackbear.com",
    "mado": "https://www.mado.com.tr",
    "simit sarayı": "https://www.simitsarayi.com",
    "özsüt": "https://www.ozsut.com.tr",
    "sütiş": "https://www.sutis.com.tr",
    "saray muhallebicisi": "https://www.saraymuhallebicisi.com",
    "bolulu hasan usta": "https://www.bhu.com.tr",
    "hafız mustafa": "https://www.hafizmustafa.com",
    "karaköy güllüoğlu": "https://www.karakoygulluoglu.com",
    "faruk güllüoğlu": "https://www.farukgulluoglu.com.tr",
    "koska": "https://www.koska.com",
    "tuğba kuruyemiş": "https://www.tugbakuruyemis.com.tr",
    "burger king": "https://www.burgerking.com.tr",
    "mcdonald": "https://www.mcdonalds.com.tr",
    "popeyes": "https://www.popeyes.com.tr",
    "kfc": "https://www.kfcturkiye.com",
    "arby's": "https://www.arbys.com.tr",
    "arbys": "https://www.arbys.com.tr",
    "sbarro": "https://www.sbarro.com.tr",
    "usta dönerci": "https://www.ustadonerci.com",
    "usta pideci": "https://www.ustapideci.com",
    "domino's": "https://www.dominos.com.tr",
    "dominos": "https://www.dominos.com.tr",
    "little caesars": "https://www.littlecaesars.com.tr",
    "pizza hut": "https://www.pizzahut.com.tr",
    "papa john": "https://www.papajohns.com.tr",
    "terra pizza": "https://www.terrapizza.com.tr",
    "pasaport pizza": "https://www.pasaportpizza.com",
    "tavuk dünyası": "https://www.tavukdunyasi.com",
    "köfteci yusuf": "https://www.kofteciyusuf.com",
    "köfteci ramiz": "https://www.kofteciramiz.com",
    "baydöner": "https://www.baydoner.com",
    "hd iskender": "https://www.hdiskender.com",
    "pidem": "https://www.pidem.com.tr",
    "kasap döner": "https://www.kasapdoner.com",
    "kasapdöner": "https://www.kasapdoner.com",
    "maydonoz döner": "https://www.maydonozdoner.com",
    "öncü döner": "https://www.oncudoner.com",
    "ekrem coşkun": "https://www.ekremcoskundoner.com.tr",
    "komagene": "https://www.komagene.com.tr",
    "oses": "https://www.oses.com.tr",
    "subway": "https://www.subway.com.tr",
    "bigchefs": "https://www.bigchefs.com.tr",
    "big chefs": "https://www.bigchefs.com.tr",
    "midpoint": "https://www.midpoint.com.tr",
    "happy moon": "https://www.happymoons.com.tr",
    "cookshop": "https://www.cookshop.com.tr",
    "divan pastane": "https://www.divanpastaneleri.com.tr",
    "pelit": "https://www.pelit.com.tr",

    # Giyim, Ayakkabı & Moda Perakende
    "lc waikiki": "https://www.lcw.com",
    "lcw": "https://www.lcw.com",
    "defacto": "https://www.defacto.com.tr",
    "koton": "https://www.koton.com",
    "mavi": "https://www.mavi.com",
    "mavi jeans": "https://www.mavi.com",
    "colin's": "https://www.colins.com.tr",
    "colins": "https://www.colins.com.tr",
    "ltb": "https://www.ltbjeans.com",
    "zara": "https://www.zara.com/tr",
    "bershka": "https://www.bershka.com/tr",
    "pull&bear": "https://www.pullandbear.com/tr",
    "pull and bear": "https://www.pullandbear.com/tr",
    "stradivarius": "https://www.stradivarius.com/tr",
    "massimo dutti": "https://www.massimodutti.com/tr",
    "h&m": "https://www2.hm.com/tr_tr",
    "mango": "https://shop.mango.com/tr",
    "boyner": "https://www.boyner.com.tr",
    "beymen": "https://www.beymen.com",
    "vakko": "https://www.vakko.com",
    "ipekyol": "https://www.ipekyol.com.tr",
    "network": "https://www.network.com.tr",
    "penti": "https://www.penti.com",
    "suwen": "https://www.suwen.com.tr",
    "dagi": "https://www.dagi.com.tr",
    "kiğılı": "https://www.kigili.com",
    "altınyıldız": "https://www.altinyildizclassics.com",
    "ds damat": "https://www.dsdamat.com",
    "süvari": "https://www.suvari.com.tr",
    "tudors": "https://www.tudors.com",
    "avva": "https://www.avva.com.tr",
    "u.s. polo": "https://tr.uspoloassn.com",
    "us polo": "https://tr.uspoloassn.com",
    "pierre cardin": "https://www.pierrecardin.com.tr",
    "sarar": "https://www.sarar.com",
    "flo": "https://www.flo.com.tr",
    "in street": "https://www.instreet.com.tr",
    "instreet": "https://www.instreet.com.tr",
    "deichmann": "https://www.deichmann.com/tr-tr",
    "kemal tanca": "https://www.kemaltanca.com.tr",
    "hotiç": "https://www.hotic.com.tr",
    "derimod": "https://www.derimod.com.tr",
    "greyder": "https://www.greyder.com",
    "desa": "https://www.desa.com.tr",
    "decathlon": "https://www.decathlon.com.tr",
    "skechers": "https://www.skechers.com.tr",
    "hummel": "https://www.hummel.com.tr",
    "ebebek": "https://www.ebebek.com",
    "e-bebek": "https://www.ebebek.com",
    "toyzz shop": "https://www.toyzzshop.com",
    "armağan oyuncak": "https://www.armaganoyuncak.com.tr",
    "d&r": "https://www.dr.com.tr",
    "bkm kitap": "https://www.bkmkitap.com",
    "atasun optik": "https://www.atasunoptik.com.tr",
    "opmar optik": "https://www.opmaroptik.com.tr",

    # Teknoloji, Beyaz Eşya, Mobilya & Yapı Market
    "teknosa": "https://www.teknosa.com",
    "mediamarkt": "https://www.mediamarkt.com.tr",
    "media markt": "https://www.mediamarkt.com.tr",
    "vatan bilgisayar": "https://www.vatanbilgisayar.com",
    "arçelik": "https://www.arcelik.com.tr",
    "beko": "https://www.beko.com.tr",
    "vestel": "https://www.vestel.com.tr",
    "bosch": "https://www.bosch-home.com.tr",
    "siemens": "https://www.siemens-home.bsh-group.com/tr",
    "profilo": "https://www.profilo.com",
    "samsung": "https://www.samsung.com/tr",
    "turkcell": "https://www.turkcell.com.tr",
    "vodafone": "https://www.vodafone.com.tr",
    "türk telekom": "https://www.turktelekom.com.tr",
    "koçtaş": "https://www.koctas.com.tr",
    "bauhaus": "https://www.bauhaus.com.tr",
    "ikea": "https://www.ikea.com.tr",
    "karaca": "https://www.karaca.com",
    "madame coco": "https://www.madamecoco.com",
    "english home": "https://www.englishhome.com",
    "chakra": "https://www.chakra.com.tr",
    "özdilek": "https://www.ozdilek.com.tr",
    "taç": "https://www.tac.com.tr",
    "istikbal": "https://www.istikbal.com.tr",
    "bellona": "https://www.bellona.com.tr",
    "mondi": "https://www.mondihome.com.tr",
    "enza home": "https://www.enzahome.com.tr",
    "enzahome": "https://www.enzahome.com.tr",
    "yataş": "https://www.yatasbedding.com.tr",
    "doğtaş": "https://www.dogtas.com",
    "kelebek mobilya": "https://www.kelebek.com",
    "vivense": "https://www.vivense.com",
    "çilek mobilya": "https://www.cilek.com",

    # Kargo, Otomotiv, Sağlık & Hizmet Zincirleri
    "yurtiçi kargo": "https://www.yurticikargo.com",
    "aras kargo": "https://www.araskargo.com.tr",
    "mng kargo": "https://www.mngkargo.com.tr",
    "sürat kargo": "https://www.suratkargo.com.tr",
    "ptt": "https://www.ptt.gov.tr",
    "ups kargo": "https://www.ups.com/tr",
    "opet": "https://www.opet.com.tr",
    "shell": "https://www.shell.com.tr",
    "petrol ofisi": "https://www.petrolofisi.com.tr",
    "totalenergies": "https://www.totalenergies.com.tr",
    "aytemiz": "https://www.aytemiz.com.tr",
    "bosch car service": "https://www.boschcarservice.com/tr",
    "otopratik": "https://www.otopratik.com.tr",
    "auto king": "https://www.autoking.com.tr",
    "autoking": "https://www.autoking.com.tr",
    "euromaster": "https://www.euromaster.com.tr",
    "tüvtürk": "https://www.tuvturk.com.tr",
    "acıbadem": "https://www.acibadem.com.tr",
    "medical park": "https://www.medicalpark.com.tr",
    "memorial": "https://www.memorial.com.tr",
    "medicana": "https://www.medicana.com.tr",
    "medipol": "https://www.medipol.com.tr",
    "liv hospital": "https://www.livhospital.com",
    "dünyagöz": "https://www.dunyagoz.com",
    "dentgroup": "https://www.dentgroup.com.tr",
    "hospitadent": "https://www.hospitadent.com",
    "macfit": "https://www.macfit.com.tr",
    "re/max": "https://www.remax.com.tr",
    "remax": "https://www.remax.com.tr",
    "coldwell banker": "https://www.cb.com.tr",
    "century 21": "https://www.century21.com.tr",
    "turyap": "https://www.turyap.com.tr",
}


def _tr_lower(text: str) -> str:
    return text.replace("İ", "i").replace("I", "ı").lower().strip()


# Tek kelimelik soyadı veya yaygın Türkçe sözcük olan markalar:
# "Karaca Kasap", "Mavi Kuaför", "Taç Pide", "PTT Yanı Büfe" gibi yerel esnaflarla çakışmaması için sıkı kontrol uygulanır.
AMBIGUOUS_SINGLE_WORD_BRANDS: set[str] = {
    "karaca", "mavi", "taç", "sarar", "network", "mango", "pelit", "koska", "oses",
    "dagi", "desa", "flo", "ptt", "shell", "opet", "aytemiz", "mondi", "bellona",
    "istikbal", "doğtaş", "yataş", "chakra", "avva", "suwen", "süvari", "tudors",
    "vakko", "boyner", "koton", "mado", "tchibo", "bim", "şok", "memorial",
    "medicana", "medipol", "bosch", "siemens", "profilo", "samsung", "coffy", "ltb",
}

LOCATION_RELATIVE_WORDS: set[str] = {
    "karşısı", "karsisi", "yanı", "yani", "arkası", "arkasi",
    "altı", "alti", "üstü", "ustu", "köşesi", "kosesi",
    "yakını", "yakini", "durağı", "duragi", "caddesi", "sokağı", "sokagi",
}

ALLOWED_BRAND_QUALIFIERS: set[str] = {
    "mağazası", "magazasi", "mağaza", "magaza", "şubesi", "subesi", "şube", "sube",
    "market", "marketler", "süpermarket", "supermarket", "express", "ekspres", "jet",
    "istasyonu", "akaryakıt", "akaryakit", "petrol", "kargo", "hastanesi", "hastane",
    "tıp", "tip", "merkezi", "home", "concept", "classics", "jeans", "collection",
    "kozmetik", "mobilya", "yatak", "tekstil", "pastanesi", "dondurma", "kahve",
    "bayii", "bayi", "yetkili",
}


def resolve_known_brand_website(
    name: str,
    brand_tag: Optional[str] = None,
    operator_tag: Optional[str] = None
) -> Optional[str]:
    """
    İşletme adı veya açık OSM `brand` etiketine göre bilinen ulusal/küresel
    bir zincir olup olmadığını kontrol eder ve yalnızca emin olunduğunda resmi web adresini döndürür.
    """
    # 1. Açık OSM brand etiketi varsa (en güvenilir kaynak)
    if brand_tag and len(brand_tag.strip()) > 1:
        b_norm = _tr_lower(brand_tag)
        if b_norm in KNOWN_BRAND_WEBSITES:
            return KNOWN_BRAND_WEBSITES[b_norm]
        for brand_key, brand_url in KNOWN_BRAND_WEBSITES.items():
            pattern = rf"(?:^|\b|\s){re.escape(brand_key)}(?:\b|\s|$)"
            if re.search(pattern, b_norm):
                return brand_url

    if not name or len(name.strip()) <= 1:
        return None

    norm = _tr_lower(name)
    tokens = [t for t in re.split(r"[^a-z0-9çğıöşü]+", norm) if t]

    # "PTT Yanı Büfe", "Migros Karşısı Eczane" gibi tarif içeren işletme adlarını ele
    if any(tok in LOCATION_RELATIVE_WORDS for tok in tokens):
        return None

    # Doğrudan tam isim eşleşmesi (Örn: "Karaca", "Mavi", "BİM", "Starbucks")
    if norm in KNOWN_BRAND_WEBSITES:
        return KNOWN_BRAND_WEBSITES[norm]

    # Kelime sınırı ile eşleşme
    for brand_key, brand_url in KNOWN_BRAND_WEBSITES.items():
        pattern = rf"(?:^|\b|\s){re.escape(brand_key)}(?:\b|\s|$)"
        if not re.search(pattern, norm):
            continue

        if brand_key in AMBIGUOUS_SINGLE_WORD_BRANDS:
            brand_tokens = set(re.split(r"[^a-z0-9çğıöşü]+", brand_key))
            extra_tokens = [t for t in tokens if t not in brand_tokens and not t.isdigit()]
            # Yanında "Eczanesi", "Kasap", "Kuaför", "Pide" gibi alakasız kelimeler varsa zincir değildir
            if extra_tokens and not all(t in ALLOWED_BRAND_QUALIFIERS for t in extra_tokens):
                continue

        return brand_url

    return None

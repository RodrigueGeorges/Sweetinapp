"""
Identité sonore Sweetin : génère les sons de l'app dans assets/sounds/ (WAV 44,1 kHz, mono, 16 bits).

Motif signature « swee-tin » : trois notes qui montent (mi, sol, do aigus), timbre de verre et de cloche,
comme une cuillère sur une coupe de glace. Tous les sons en dérivent, pour qu'on reconnaisse Sweetin à l'oreille.

    python3 scripts/generate_sounds.py
"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(2027)

NOTE = {'C5': 523.25, 'E5': 659.25, 'G5': 783.99, 'C6': 1046.50, 'E6': 1318.51, 'G6': 1567.98, 'C7': 2093.00, 'E7': 2637.02, 'G7': 3135.96, 'C4': 261.63, 'G4': 392.00, 'C3': 130.81}


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack=0.004, decay=0.35, sr=SR):
    x = np.arange(n) / sr
    a = np.clip(x / max(attack, 1e-6), 0, 1)
    return a * np.exp(-x / decay)


def bell(freq, sec=1.0, decay=0.35, bright=1.0):
    """Cloche de verre : fondamentale + partiels inharmoniques qui s'éteignent plus vite."""
    x = t(sec)
    n = len(x)
    s = np.zeros(n)
    # (multiple, gain, attaque, part du déclin) ; on ignore tout partiel au-dessus de 18 kHz (pas de repliement)
    for mult, gain, att, dec in ((1, 1.0, 0.003, 1.0), (2.76, 0.45 * bright, 0.002, 0.45), (5.40, 0.25 * bright, 0.001, 0.25), (0.5, 0.12, 0.01, 1.2)):
        if freq * mult < 18000:
            s += gain * np.sin(2 * np.pi * freq * mult * x) * env(n, att, decay * dec)
    tail = min(n // 3, int(0.08 * SR))
    s[-tail:] *= np.linspace(1, 0, tail) ** 2  # chaque note s'éteint d'elle-même : aucun clic
    return s


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def band(sig, lo, hi, order=4):
    sos = butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return sosfilt(sos, sig)


def lowpass(sig, hi, order=4):
    sos = butter(order, hi, btype='low', fs=SR, output='sos')
    return sosfilt(sos, sig)


def place(buf, sig, at):
    i = int(at * SR)
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[: end - i]
    return buf


def finish(sig, peak_db=-3.0, loop=False):
    """Coupe le silence de fin, fondu court à l'attaque et plus long à la fin (pas de clic), puis normalise."""
    sig = sig / (np.max(np.abs(sig)) + 1e-9)
    if not loop:
        above = np.where(np.abs(sig) > 10 ** (-55 / 20))[0]
        sig = sig[: (above[-1] + 1) if len(above) else len(sig)]
    fi, fo = int(0.002 * SR), min(len(sig) // 3, int((0.03 if loop else 0.12) * SR))
    sig[:fi] *= np.linspace(0, 1, fi)
    sig[-fo:] *= np.linspace(1, 0, fo) ** (1 if loop else 2)
    return sig * (10 ** (peak_db / 20))


def save(name, sig, peak_db=-3.0, loop=False):
    sig = finish(sig.astype(np.float64), peak_db, loop)
    wavfile.write(os.path.join(OUT, name), SR, (sig * 32767).astype(np.int16))
    print(f'{name:16s} {len(sig) / SR:4.2f} s')


def motif(buf, at=0.0, notes=('E6', 'G6', 'C7'), gap=0.085, decay=0.42, gain=1.0):
    for i, nm in enumerate(notes):
        place(buf, gain * bell(NOTE[nm], 1.2, decay * (1.25 if i == len(notes) - 1 else 1)), at + i * gap)
    return buf


def sparkle(buf, at, count=10, span=0.5, lo=3000, hi=7000, gain=0.12):
    for _ in range(count):
        f = rng.uniform(lo, hi)
        place(buf, gain * bell(f, 0.25, 0.05, 0.4), at + rng.uniform(0, span))
    return buf


def main():
    os.makedirs(OUT, exist_ok=True)

    # 1. notification « un flip pour toi » : le motif signature, net et court
    b = np.zeros(int(SR * 2.2))
    motif(b, 0.0)
    sparkle(b, 0.22, 6, 0.35, gain=0.08)
    save('sweet.wav', b)

    # 2. grattage : grain de feuille métallisée, à jouer en boucle sous le doigt
    x = noise(1.2)
    g = band(x, 2200, 9000) * 0.8 + band(x, 600, 1800) * 0.25
    flutter = 0.65 + 0.35 * np.abs(np.sin(2 * np.pi * 13 * t(1.2) + rng.uniform(0, 3)))
    grains = np.zeros_like(g)
    for _ in range(90):
        i = rng.integers(0, len(g) - 400)
        grains[i:i + 400] += np.hanning(400) * rng.uniform(0.4, 1.0)
    g = g * flutter * (0.55 + grains)
    save('scratch.wav', g, peak_db=-8.0, loop=True)

    # 3. révélation : « pouf » doux puis pluie de paillettes qui monte jusqu'au motif
    b = np.zeros(int(SR * 2.6))
    thump = lowpass(noise(0.25), 220) * env(int(SR * 0.25), 0.002, 0.06) * 3
    place(b, thump, 0)
    place(b, band(noise(0.3), 1500, 6000) * env(int(SR * 0.3), 0.001, 0.05) * 0.6, 0)
    for i, nm in enumerate(['C6', 'E6', 'G6', 'C7', 'E7']):
        place(b, 0.7 * bell(NOTE[nm], 1.0, 0.3), 0.08 + i * 0.055)
    sparkle(b, 0.12, 18, 0.9, gain=0.1)
    save('reveal.wav', b)

    # 4. envoi : souffle qui file vers le haut, petit « pop », deux notes du motif
    b = np.zeros(int(SR * 2.0))
    # souffle dont le filtre monte en continu (fenêtres qui se chevauchent : pas de marches audibles)
    dur = 0.38
    sweep = np.zeros(int(SR * dur))
    win = int(0.06 * SR)
    hop = win // 4
    src = noise(dur + 0.1)
    for k, start in enumerate(range(0, len(sweep) - win, hop)):
        lo = 500 * (10 ** (start / len(sweep)))
        seg = band(src[start:start + win * 2], lo, min(lo * 2.2, 18000))[:win]
        sweep[start:start + win] += seg * np.hanning(win)
    sweep *= np.sin(np.linspace(0, np.pi, len(sweep))) * 0.8
    place(b, sweep, 0)
    pop = np.sin(2 * np.pi * np.linspace(900, 300, int(SR * 0.05)).cumsum() / SR) * env(int(SR * 0.05), 0.001, 0.015)
    place(b, pop * 0.9, 0.36)
    motif(b, 0.38, ('G6', 'C7'), gap=0.07, decay=0.3, gain=0.8)
    save('sent.wav', b)

    # 5. Sweet Hour : le motif en fanfare, deux fois, avec une basse — « c'est maintenant »
    b = np.zeros(int(SR * 3.4))
    for k, at in enumerate([0.0, 0.42]):
        motif(b, at, ('E6', 'G6', 'C7') if k == 0 else ('G6', 'C7', 'E7'), gap=0.09, decay=0.45)
    bass = np.sin(2 * np.pi * NOTE['C3'] * t(1.6)) * env(int(SR * 1.6), 0.01, 0.5) * 0.5
    place(b, bass, 0.42)
    place(b, 0.6 * bell(NOTE['C6'], 1.6, 0.8, 0.6), 0.42)
    sparkle(b, 0.6, 22, 1.2, gain=0.09)
    save('sweethour.wav', b)

    # 6. série : flamme chaude (souffle grave) puis deux notes qui montent
    b = np.zeros(int(SR * 2.0))
    fl = band(noise(0.6), 200, 1200) * np.sin(np.linspace(0, np.pi, int(SR * 0.6))) ** 2
    place(b, fl * 0.9, 0)
    place(b, 0.8 * bell(NOTE['G5'], 0.9, 0.3), 0.25)
    place(b, 0.9 * bell(NOTE['C6'], 1.0, 0.45), 0.36)
    save('streak.wav', b)

    # 7. tap : clic de verre très court pour les boutons
    b = 0.8 * bell(NOTE['C7'], 0.12, 0.025, 0.6)
    save('tap.wav', b, peak_db=-12.0)

    melt_sound()


def drop(f0, f1, sec=0.09, decay=0.05):
    """Une goutte : sinus dont la hauteur monte très vite (le « plic »), avec une petite harmonique."""
    x = t(sec)
    f = f0 + (f1 - f0) * (1 - np.exp(-x / 0.012))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.25 * np.sin(2 * ph)) * env(len(x), 0.001, decay)


def melt_sound():
    """8. ça fond : trois gouttes qui ralentissent (« plic… plic… plic »), la dernière plus grave, sur une note de verre."""
    b = np.zeros(int(SR * 1.2))
    place(b, 0.5 * bell(NOTE['C6'], 1.0, 0.5, 0.6), 0.0)
    place(b, 1.0 * drop(700, 1700), 0.05)
    place(b, 0.75 * drop(600, 1450), 0.31)
    place(b, 0.55 * drop(480, 1150, 0.12, 0.07), 0.67)
    save('melt.wav', lowpass(b, 6000))


if __name__ == '__main__':
    main()

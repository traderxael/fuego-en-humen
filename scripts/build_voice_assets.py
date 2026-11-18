"""
Generate neural Spanish narration tracks (.mp3) for Fuego en Humen via edge-tts.

Voices used:
  - es-ES-AlvaroNeural (Maestro Xu / chronicler — solemn, measured historian)
  - es-MX-JorgeNeural  (Lin Zexu / Admiral Guan Tianpei — commanding gravitas)
  - es-CO-GonzaloNeural (Sergeant Chen / coastal watchmen — urgent battle reports)

Usage:
  python scripts/build_voice_assets.py
"""

import asyncio
import os
import edge_tts

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT_DIR, "assets", "audio", "voice")

XU = "es-ES-AlvaroNeural"
COMMANDER = "es-MX-JorgeNeural"
CHEN = "es-CO-GonzaloNeural"

# (key, voice, rate, pitch, text)
CLIPS = [
    # Briefing
    (
        "briefing", XU, "-6%", "-4Hz",
        "Humen, mil ochocientos cuarenta y uno. Yo, Xu, vi arrojar el opio al mar en mil ochocientos treinta y nueve. Hoy regresa la escuadra inglesa para cobrarse con fuego. Tú estás en la muralla de Weiyuan.",
    ),

    # Cinematics: 1839 Opium Destruction
    (
        "cine-1839-0", COMMANDER, "-6%", "-3Hz",
        "Tres de junio de mil ochocientos treinta y nueve. Lin Zexu ordena abrir las cajas en la playa de Humen. Ni una sola caja regresará intacta al mar; que la cal viva y la marea borren este veneno de nuestras costas.",
    ),
    (
        "cine-1839-1", XU, "-5%", "-4Hz",
        "Durante veintitrés días, el opio mezclado con cal y sal se disuelve en las tres fosas de piedra hasta la marea baja. Más de mil toneladas ardieron y se hundieron ante la mirada de los comerciantes extranjeros.",
    ),
    (
        "cine-1839-2", CHEN, "-4%", "-2Hz",
        "Desde el pabellón, el comisario vigiló cada carga. Meses después, Londres respondió con cañones y sus navíos tomaron los fuertes exteriores de Shajiao y Dajiao.",
    ),
    (
        "cine-1839-3", XU, "-6%", "-4Hz",
        "Veinte meses y veintitrés días separan la quema del opio del asalto a la bocana de Humen. Aquí comienza nuestra defensa en la batería de Weiyuan.",
    ),

    # Cinematics: 23 Feb 1841 Squadron Forces the Bogue
    (
        "cine-squadron-0", CHEN, "-3%", "-2Hz",
        "Veintitrés de febrero de mil ochocientos cuarenta y uno. Doce navíos británicos fuerzan la bocana contra treinta juncos chinos. El vapor de hierro Némesis embiste nuestra cadena del río.",
    ),
    (
        "cine-squadron-1", COMMANDER, "-5%", "-3Hz",
        "Sus ruedas de paletas remontan la corriente sin viento y lanzan cohetes incendiarios sobre Anunghoy. ¡Asegurad las piezas de retaguardia!",
    ),

    # Cinematics: 26 Feb 1841 Rear Assault & Guan Tianpei
    (
        "cine-assault-0", CHEN, "-2%", "-1Hz",
        "Veintiséis de febrero de mil ochocientos cuarenta y uno, una y veinte de la tarde. Tras el bombardeo, los marines desembarcan y el portón de madera cede bajo los hachazos. ¡Cerrad la brecha en la puerta norte!",
    ),
    (
        "cine-assault-1", XU, "-4%", "-4Hz",
        "Mil treinta y siete hombres trepan por las escalas de bambú contra el granito mientras la artillería enemiga barre todo el parapeto.",
    ),
    (
        "cine-assault-2", COMMANDER, "-7%", "-5Hz",
        "Lleva mi sello al emperador. Yo, Guan Tianpei, juré guardar estas baterías con mi vida; rendirse sería traición. No daré un paso atrás.",
    ),

    # Cinematics: Afternoon of 26 Feb 1841 Fall & Bell
    (
        "cine-fall-0", XU, "-6%", "-4Hz",
        "Cayeron trescientas treinta y nueve piezas de artillería y mil trescientos defensores. Los cañones de bronce yacen clavados; la campana de Humen enmudece bajo otro pabellón.",
    ),
    (
        "cine-fall-1", XU, "-6%", "-4Hz",
        "Al día siguiente, la familia del almirante Guan Tianpei reclamó su cuerpo, y la fragata inglesa Blenheim lo despidió con una salva de honor minuto a minuto.",
    ),
    (
        "cine-fall-2", XU, "-6%", "-4Hz",
        "Humen cayó ese día. Cantón se rindió en mayo y el Tratado de Nankín cerró la guerra, pero la memoria de quienes resistieron en la piedra permanece intacta.",
    ),

    # Campaign Waves (1..10)
    ("wave-1", XU, "-4%", "-4Hz", "La primera balsa toca la arena. Los casacas rojas marchan paso doble hacia la muralla."),
    ("wave-2", XU, "-4%", "-4Hz", "La segunda ola trae cañones de campaña. La piedra aprenderá a temblar."),
    ("wave-3", XU, "-4%", "-4Hz", "La tercera fila asalta el parapeto con escalas. Si cae la muralla, cae todo el río."),
    ("wave-4", XU, "-4%", "-4Hz", "El sol desciende sobre el estuario. Llegan refuerzos desde la escuadra británica."),
    ("wave-5", XU, "-4%", "-4Hz", "La tarde arde en pólvora. Empujad a los infantes de marina fuera del muro."),
    ("wave-6", XU, "-4%", "-4Hz", "Una marea humana embiste las almenas. Ni un paso atrás en Weiyuan."),
    ("wave-7", XU, "-4%", "-4Hz", "La noche cubre la bocana de Anunghoy. Solo los fogonazos iluminan la playa."),
    ("wave-8", XU, "-4%", "-4Hz", "Un amanecer roto sobre el río de la Perla. Resistid hasta el relevo."),
    ("wave-9", XU, "-4%", "-4Hz", "Cuatro cañones enemigos baten el patio sin tregua. Silenciad sus baterías."),
    ("wave-10", XU, "-4%", "-4Hz", "El último asalto británico. Humen resiste mientras quede un solo defensor en pie."),

    # Historical Beats & Radio
    ("beat-landing", XU, "-4%", "-4Hz", "El vapor Némesis busca el paso trasero de la isla de Anunghoy para rodear nuestras baterías."),
    ("beat-artillery", CHEN, "-3%", "-2Hz", "Pieza de artillería enemiga silenciada. Sin sus cañones, la muralla aún aguanta."),
    ("beat-officer", CHEN, "-3%", "-2Hz", "El oficial de la columna británica ha caído. Sin mando, su asalto se quiebra."),
    ("beat-assault", XU, "-4%", "-4Hz", "Trescientos marines y marineros fijan las escalas contra el granito del fuerte."),
    ("beat-guan", XU, "-5%", "-4Hz", "El almirante Guan Tianpei no suelta el puesto de tiro y entrega su sello antes de caer."),
    ("radio-lowfort", CHEN, "-2%", "-2Hz", "La muralla está cediendo. Defended la brecha con el sable y los cañones del patio."),

    # Endings
    ("end-victory", XU, "-6%", "-4Hz", "El mar se queda sin botes. El fuerte de Humen, contra toda razón, sigue en pie."),
    ("end-soldier", XU, "-6%", "-4Hz", "El soldado cae en el parapeto, pero la muralla aún guarda su último aliento."),
    ("end-fort", XU, "-6%", "-4Hz", "La piedra se abre bajo el fuego británico. El río, esta vez, no nos escucha."),
]


async def synth_one(sem, key, voice, rate, pitch, text):
    async with sem:
        out_path = os.path.join(OUT_DIR, f"{key}.mp3")
        comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await comm.save(out_path)
        size = os.path.getsize(out_path)
        print(f"BUILT {key}.mp3 ({size / 1024:.1f} KB)")


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sem = asyncio.Semaphore(5)
    await asyncio.gather(*(synth_one(sem, *item) for item in CLIPS))
    print(f"ALL {len(CLIPS)} VOICE CLIPS GENERATED IN {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())

# Autos + Bomben (kleines Pygame-Demo)

Kurzanleitung:

- Installiere Abhängigkeiten:

```bash
python -m pip install -r "requirements.txt"
```

- Starte das Spiel:

```bash
python "main.py"
```

Steuerung:

- Drücke `P` um ein 2D-Auto an der aktuellen Mausposition zu spawnen.
- Linksklick auf ein Auto lässt eine Bombe vom Himmel auf dessen Position fallen und zerstört es.
- `ESC` oder Fenster schließen beendet das Spiel.

Hinweis: Dieses kleine Demo nutzt einfache Flächen- und Kreiszeichnungen (keine externen Assets) für die Python-Version.

Web-Version: Wenn du das mitgelieferte Auto-Bild verwenden möchtest, speichere die angehängte Bilddatei als `car.png` im selben Ordner wie `index.html`.
Dann öffne `index.html` im Browser; die Webseite verwendet `car.png`, fällt aber auf eine einfache Farbbox zurück, falls die Datei fehlt.

Optional: Bomben-Textur
----------------------
Wenn du eine eigene Bomben-Grafik verwenden möchtest, speichere die Datei als `bomb.png` im selben Ordner wie `index.html`.
Die Webseite versucht, helle Hintergründe automatisch transparent zu machen; wenn die Datei fehlt, wird eine einfache rote Kugel als Bombe gezeichnet.

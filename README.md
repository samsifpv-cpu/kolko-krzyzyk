# Kółko i krzyżyk — gra w sieci lokalnej (LAN)

Prosty serwer Node.js, który pozwala dwóm osobom zagrać w kółko i krzyżyk
na dwóch różnych urządzeniach (np. telefon + laptop) podłączonych do tej
samej sieci Wi-Fi / LAN.

## Wymagania

- Zainstalowany [Node.js](https://nodejs.org) (wersja 16 lub nowsza).

## Jak uruchomić

1. Rozpakuj ten plik ZIP.
2. Otwórz terminal / wiersz poleceń w rozpakowanym folderze `ttt-server`.
3. Zainstaluj zależności (tylko raz):

   ```
   npm install
   ```

4. Odpal serwer:

   ```
   npm start
   ```

5. W terminalu pojawią się dwa adresy, np.:

   ```
   Na tym komputerze:  http://localhost:3000
   W sieci lokalnej:   http://192.168.1.23:3000
   ```

6. **Osoba uruchamiająca serwer** otwiera w przeglądarce `http://localhost:3000`.
   **Druga osoba** (na innym urządzeniu w tej samej sieci) otwiera adres
   "W sieci lokalnej" (np. `http://192.168.1.23:3000`).

## Jak grać

1. Jedna osoba wpisuje swoje imię i klika **„Stwórz pokój”** — dostaje 4-znakowy kod.
2. Druga osoba wpisuje swoje imię, przełącza zakładkę na **„Dołącz kodem”**,
   wpisuje ten kod i klika **„Dołącz”**.
3. Gra zaczyna się automatycznie. Ruchy synchronizują się w czasie rzeczywistym.
4. Po meczu można kliknąć **„Nowa runda”**, żeby zagrać jeszcze raz w tym samym pokoju.

## Ranking

Wyniki (wygrane / remisy / porażki) są zapisywane po imieniu gracza
w pliku `ranking.json` na serwerze — przetrwają restart serwera.
Ranking jest wspólny dla wszystkich grających w danej chwili na tym serwerze.
Przycisk **„Wyczyść ranking”** zeruje wszystkie statystyki.

## Uwagi

- Serwer i obaj grający muszą być w **tej samej sieci lokalnej** (to samo Wi-Fi/router).
  Gra nie zadziała przez internet bez dodatkowej konfiguracji (np. tunelowania albo hostingu).
- Jeśli druga osoba nie może się połączyć, sprawdź zapory sieciowe (firewall)
  na komputerze, na którym działa serwer — port 3000 musi być dostępny w sieci lokalnej.
- Żeby zmienić port, ustaw zmienną środowiskową `PORT`, np. `PORT=4000 npm start`.

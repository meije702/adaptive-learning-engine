# Adaptive Learning Engine

_Een open-source platform dat elke professional begeleidt van waar ze zijn naar
waar ze willen zijn — met AI als motor, niet als eigenaar._

---

## Het probleem

Bestaande leermiddelen zijn statisch. Een cursus heeft een vast startpunt, een
vast tempo, en vaste content. Als je meer weet dan de cursus aanneemt, verveel
je je. Als je minder weet, verlies je de aansluiting. Als je een andere
achtergrond hebt, missen de analogieën. En als het leven tussendoor komt, loopt
het schema vast.

Het resultaat: professionals besteden meer tijd aan het navigeren van
lesmateriaal dan aan het daadwerkelijk leren.

## De oplossing

Een leersysteem dat zich aanpast aan de leerling, niet andersom. Geen vast
lesmateriaal. Geen voorgedefinieerde toetsen. Alleen een doel, een startpunt, en
een AI die de weg daartussen elke dag opnieuw berekent.

Het systeem kent twee componenten:

**Een web applicatie** die de leerling bezit. Hier staat alle voortgang, alle
gegenereerde content, alle antwoorden en feedback. De app werkt onafhankelijk
van welke AI eraan gekoppeld is. Het is het dossier van de leerling.

**Een AI agent** die via een gestandaardiseerd protocol (MCP) de app leest en
schrijft. De agent genereert theorie, oefeningen en toetsen. Beoordeelt
antwoorden. Berekent het optimale volgende onderwerp. Maar de agent is
vervangbaar — het protocol is het contract, niet de implementatie.

## Kernfilosofie

### Alles is een bridge

Elke stap in het leerproces is een transformatie van een bekende state naar een
nieuwe state. Dit patroon — de _bridge_ — is het recursieve principe dat het
hele systeem stuurt.

Op het hoogste niveau: "Java developer" → "Rust engineer." Op domeinniveau:
"Kent HTTP" → "Begrijpt gRPC." Op weekniveau: "Level 2" → "Level 3." Op
dagniveau: "Las de theorie" → "Kan het toepassen."

De `from`-kant van een bridge mag leeg zijn. Niet iedereen heeft voorkennis. Het
systeem herkent dit en past de strategie aan: waar een ervaren professional
leert via analogie, leert een beginner via first principles.

Wanneer de afstand tussen `from` en `to` onrealistisch groot is, is het systeem
eerlijk. Het adviseert een ander doel, een langer traject, of een tussenstap.
Geen tool dat ja zegt op alles en je halverwege laat stranden.

### Configuratie boven code

Het platform weet niets over Kubernetes, Rust, machine learning, of welk
onderwerp dan ook. Alle domeinkennis leeft in configuratiebestanden:

- **curriculum.config** — het leertraject: domeinen, fases, bruggen
- **learner.config** — het profiel: achtergrond, schema, voorkeuren
- **system.config** — technische instellingen: AI-provider, timing, parameters

Een nieuw leertraject opzetten betekent drie YAML-bestanden schrijven. Geen code
aanraken. Fork het project, pas de config aan, deploy, begin.

### De AI adviseert, de leerling beslist

Het systeem genereert, evalueert en adviseert. Maar het neemt geen beslissingen
over de leerling. Wanneer de AI denkt dat het tempo te hoog is, meldt het dit —
maar de leerling bepaalt of het tempo daadwerkelijk wordt aangepast. Wanneer de
AI een stretch-module voorstelt, kan de leerling deze overslaan.

De AI is een coach, geen docent. Het stelt vragen in plaats van alleen
antwoorden te geven. Het geeft scenario's in plaats van definities. Het
behandelt de leerling als een professional die eigen keuzes maakt.

### Meten is weten

Geen enkele bewering over voortgang is gebaseerd op gevoel. Elk competentie-
niveau is het resultaat van concrete assessments. Elke aanpassing aan het
leerpad is gebaseerd op data uit de kennisgraaf. Spaced repetition intervallen
worden berekend, niet geschat.

Het systeem toont de leerling exact waar zij staat, met welke onderbouwing, en
wat het volgende meetmoment is. Transparantie over het eigen leerproces is een
kernwaarde.

## Het ritme

Het systeem werkt in weekcycli. Elke week heeft één hoofddomein en volgt een
vast maar configureerbaar patroon:

De week begint met theorie die aansluit op bestaande kennis. De dagen daarna
bouwen op via oefeningen van begeleid naar zelfstandig. De week eindigt met een
assessment dat meetelt voor het competentieniveau. Dagelijks herhaalt het
systeem eerder behandelde stof via korte retentievragen.

Eén dag per week is een rustdag. Op die dag werkt de AI: het evalueert de
afgelopen week, herberekent de gaps, en bereidt de volgende week voor. De
leerling opent de app de volgende ochtend en alles staat klaar.

Het assessment en de bijbehorende feedback zijn bewust gescheiden in tijd. De
leerling krijgt ruimte om het assessment te maken wanneer het uitkomt, en leest
de feedback op een rustig moment. Geen directe druk, wel duidelijke deadlines.

## Het bouwplan

De eerste versie draait op Deno Deploy met Fresh als web framework en Deno KV
als opslag. De MCP server is een laag bovenop de REST API die AI-agents toegang
geeft tot dezelfde data als de web interface.

De ambitie is dat het platform zelf een leerproject kan worden. Een leerling die
Kubernetes leert, kan het platform gaandeweg migreren naar een eigen cluster. De
infrastructuur groeit mee met de kennis.

## Referenties

De technische details zijn vastgelegd in drie Architecture Decision Records:

- **ADR-001** — Data model, REST API, en MCP server contract
- **ADR-002** — Configuration-first design met het volledige config schema
- **ADR-003** — Bridge als kernprincipe en de intake-fase

Elk ADR staat op zichzelf maar bouwt voort op de vorige. Samen vormen ze de
volledige technische specificatie van het platform.

---

_Dit project is ontstaan vanuit een persoonlijke behoefte: een senior engineer
die een nieuw domein wilde leren op een manier die paste bij zijn ervaring, zijn
tempo, en zijn manier van denken. Het idee dat dit voor meer mensen kan werken,
is de reden dat het een open platform is geworden._

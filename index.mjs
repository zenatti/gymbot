import 'dotenv/config'
import {loginApp, selezionaSede, palinsesti, prenotazione} from './shaggyowl.mjs';
import {format, addDays} from 'date-fns';
//import NodeCache from 'node-cache';
//const myCache = new NodeCache()
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const NEXT_DAY_TO_CHECK = 3;

const BOOKINGS = {
    Monday: ["18:30"],
    Tuesday: [],
    Wednesday: ["18:30"],
    Thursday: [],
    Friday: ["18:00"],
    Saturday: ["10:00"],
    Sunday: []
}

let id_sede_selezionata = null;

// login nell'app
const body_login = await loginApp(process.env.APP_USER, process.env.APP_PWD);
let codice_sessione = body_login?.parametri?.sessione.codice_sessione;

let sedi = body_login?.parametri?.sedi_collegate;
let opifit = Array.isArray(sedi) ? sedi.find(s => s.nome === "Opifit") : null;

// check sede trovata
if (codice_sessione && opifit) {

    // la seleziono
    const body_sede = await selezionaSede(opifit.id_sede, codice_sessione);
    id_sede_selezionata = body_sede?.parametri?.sessione?.idSede;

}

console.log("Sessione:", codice_sessione);
console.log("Sede selezionata:", id_sede_selezionata);

if (id_sede_selezionata && id_sede_selezionata === opifit.id_sede) {

    // prendo i palinsesti
    const data = format(new Date(), 'yyyy-MM-dd');

    // palinsesti
    const body_palinsesti = await palinsesti(id_sede_selezionata, codice_sessione, data);

    // data da controllare (+3gg)
    const data_to_check = format(addDays(new Date(), NEXT_DAY_TO_CHECK), 'yyyy-MM-dd');

    // ciclo i giorni nel palinsesto (7)
    let giorni = Array.isArray(body_palinsesti?.parametri?.lista_risultati) ? body_palinsesti?.parametri?.lista_risultati[0]?.giorni : [];
    giorni.forEach(g => {

        // controllo il giorno da controllare (quello tra 72h solitamente)
        if (g.giorno === data_to_check) {

            // prendo la chiave della mappa BOOKING (il weekday)
            let booking_key = format(new Date(g.giorno), 'eeee');
            console.log("Controllo:", g.giorno, booking_key);

            // ciclo i bookigns per quella giornata
            BOOKINGS[booking_key].forEach(async (b) => {

                // cerco un allenamento che corriposnda alla data di inizio
                let allenamento = g.orari_giorno.find(t => t.orario_inizio === b);
                if (allenamento && allenamento.is_online === '1') {

                    // controllo se già prenotato
                    if (allenamento.prenotazioni.utente_prenotato === '0') {
                        console.log("Prenoto:", allenamento.id_orario_palinsesto);

                        // prenota

                        const body_prenotazione = await prenotazione(id_sede_selezionata, codice_sessione, g.giorno, allenamento.id_orario_palinsesto);
                        if (body_prenotazione?.parametri?.prenotazione?.stato === '1') {

                            let bodyMail = `
                                Prenotazione confermata per la lezione di <strong>${body_prenotazione?.parametri?.prenotazione?.nome_corso}</strong>
                                del <strong>${body_prenotazione?.parametri?.prenotazione?.data}</strong>
                                alle ore <strong>${body_prenotazione?.parametri?.prenotazione?.orario_inizio}</strong>.
                                <br />
                                <br />
                                ${body_prenotazione?.parametri?.frase}
                            `;

                            const msg = {
                                to: process.env.NOTIFICATIONS_MAIL,
                                from: 'test@gymbot',
                                subject: 'Notifica prenotazione',
                                text: bodyMail,
                                html: bodyMail
                            }

                            sgMail.send(msg)
                                  .then((response) => {
                                      //console.log(response[0].statusCode)
                                      //console.log(response[0].headers)
                                  })
                                  .catch((error) => {
                                      //console.error(error)
                                  });

                        }

                    }
                    else {
                        console.log("Già Prenotato:", allenamento.id_orario_palinsesto);
                    }

                }

            });
        }
    });

}


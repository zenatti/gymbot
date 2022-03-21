import 'dotenv/config'
import {loginApp, selezionaSede, palinsesti, prenotazione} from './shaggyowl.mjs';
import {format, addDays, parse} from 'date-fns';
import sgMail from '@sendgrid/mail';
import express from 'express';

// forze timezone
process.env.TZ = 'Europe/Rome';

// configure sendgrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

/**
 *
 * @type {number}
 */
const HOURS_LIMIT = 0.1;

/**
 * Polling MS
 * @type {number}
 */
const POLLING_MS = process.env.POLLING_MS ? parseInt(process.env.POLLING_MS, 10) : 2 * 1000;

/**
 *
 * @type {object}
 */
const BOOKINGS = {
    Monday: ["18:30"],
    Tuesday: [],
    Wednesday: ["18:30"],
    Thursday: [],
    Friday: ["18:00"],
    Saturday: ["10:00"],
    Sunday: []
};

/**
 *
 * @type {number}
 */
const NEXT_DAY_TO_CHECK = process.env.NEXT_DAY_TO_CHECK || "1";

/**
 *
 * @param stato
 * @returns {string}
 */
let getStatoText = (stato) => {
    if (stato === '1') {
        return 'Coda';
    }
    else if (stato === '2') {
        return 'Lista';
    }
    return 'Sconosciuto (' + stato + ')';
}

/**
 * Controlla se si sta avvicindnado una prenotazione da fare
 */
let checkInterval = () => {

    // data da controllare (+3gg)
    const data_to_check = format(addDays(new Date(), parseInt(NEXT_DAY_TO_CHECK, 10)), 'yyyy-MM-dd');
    const booking_key = format(new Date(data_to_check), 'eeee');

    if (process.env.BOT_ENV && process.env.BOT_ENV === "local") {
        console.log("data_to_check", data_to_check);
        console.log("booking_key", booking_key);
        console.log("bookings", BOOKINGS[booking_key]);
    }

    // ciclo i bookigns per quella giornata
    BOOKINGS[booking_key].forEach(async (b) => {

        let bookHours = parse(b, 'HH:mm', new Date());
        let nowHours = new Date();
        let hours = Math.abs(bookHours - nowHours) / 36e5;

        // local debug
        if (process.env.BOT_ENV && process.env.BOT_ENV === "local") {
            console.log("CHECK:", bookHours, nowHours, hours);
        }

        if (process.env.BOT_DEBUG && process.env.BOT_DEBUG === "true") {
            const bodyMail = `Debug Check Interval, Checking!<br /><br />${JSON.stringify(BOOKINGS)}<br />${data_to_check}<br />${booking_key}<br /><br />${bookHours}<br />${nowHours}<br />${hours}`;
            sgMail.send({
                to: process.env.NOTIFICATIONS_MAIL,
                from: 'test@gymbot',
                subject: `Debug interval ${process.env.BOT_ENV}`,
                text: bodyMail,
                html: bodyMail
            }).then((response) => {
            }).catch((error) => {
            });
        }

        // poco prima e poco dopo lancio le chiamate
        if (hours < HOURS_LIMIT) {
            runBooker();
        }

    });

}
setInterval(checkInterval, POLLING_MS);

/**
 *
 */
const runBooker = async () => {

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

    if (process.env.BOT_ENV && process.env.BOT_ENV === "local") {
        console.log("Sessione:", codice_sessione);
        console.log("Sede selezionata:", id_sede_selezionata);
    }

    if (id_sede_selezionata && id_sede_selezionata === opifit.id_sede) {

        // prendo i palinsesti
        const data = format(new Date(), 'yyyy-MM-dd');

        // palinsesti
        const body_palinsesti = await palinsesti(id_sede_selezionata, codice_sessione, data);

        // data da controllare (+3gg)
        const data_to_check = format(addDays(new Date(), parseInt(NEXT_DAY_TO_CHECK, 10)), 'yyyy-MM-dd');

        // ciclo i giorni nel palinsesto (7)
        let giorni = Array.isArray(body_palinsesti?.parametri?.lista_risultati) ? body_palinsesti?.parametri?.lista_risultati[0]?.giorni : [];
        giorni.forEach(g => {

            // controllo il giorno da controllare (quello tra 72h solitamente)
            if (g.giorno === data_to_check) {

                // prendo la chiave della mappa BOOKING (il weekday)
                let booking_key = format(new Date(g.giorno), 'eeee');
                if (process.env.BOT_ENV && process.env.BOT_ENV === "local") {
                    console.log("Controllo:", g.giorno, booking_key);
                }

                // ciclo i bookigns per quella giornata
                BOOKINGS[booking_key].forEach(async (b) => {

                    // cerco un allenamento che corriposnda alla data di inizio
                    let allenamento = g.orari_giorno.find(t => t.orario_inizio === b);
                    if (allenamento && allenamento.is_online === '1') {

                        // controllo se già prenotato
                        if (allenamento.prenotazioni.utente_prenotato === '0') {
                            if (process.env.BOT_ENV && process.env.BOT_ENV === "local") {
                                console.log("Prenoto:", allenamento.id_orario_palinsesto);
                            }

                            // prenota
                            const body_prenotazione = await prenotazione(id_sede_selezionata, codice_sessione, g.giorno, allenamento.id_orario_palinsesto);
                            if (process.env.BOT_ENV && process.env.BOT_ENV === "local") {
                                console.log("Prenotazione:", body_prenotazione);
                            }
                            if (['1', '2'].indexOf(body_prenotazione?.parametri?.prenotazione?.stato)) {

                                const bodyMail = `
                                    Prenotazione confermata per la lezione di <strong>${body_prenotazione?.parametri?.prenotazione?.nome_corso}</strong>
                                    del <strong>${body_prenotazione?.parametri?.prenotazione?.data}</strong>
                                    alle ore <strong>${body_prenotazione?.parametri?.prenotazione?.orario_inizio}</strong>.
                                    <br />
                                    Sei in <strong>${getStatoText(body_prenotazione?.parametri?.prenotazione?.stato)}</strong>
                                    <br />
                                    <br />
                                    ${body_prenotazione?.parametri?.frase}
                                `;

                                sgMail.send({
                                    to: process.env.NOTIFICATIONS_MAIL,
                                    from: 'test@gymbot',
                                    subject: `Notifica prenotazione: ${getStatoText(body_prenotazione?.parametri?.prenotazione?.stato)} (${process.env.BOT_ENV})`,
                                    text: bodyMail,
                                    html: bodyMail
                                }).then((response) => {
                                    //console.log(response[0].statusCode)
                                    //console.log(response[0].headers)
                                }).catch((error) => {
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

}

const app = express();
const port = process.env.PORT || 3000;

app.get('/run-booker', async (req, res) => {
    await runBooker();
    res.send(`BOOKER LAUNCHED`);
})

app.get('/', (req, res) => {
    res.send(`Status: RUNNING`);
})

app.listen(port, () => {
    console.log(`Gymbot running on port ${port}`);
});


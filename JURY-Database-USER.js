// During my time in JURY, I have created a dtabase that I used to streamline my work by logging all warnings, arrests and violations of specific users with set timeframes in which they expire and are no longer valid.
// This is my User class that I used to interact with users' records.

const { Pool, Client } = require('pg');
const Utility = require('./utility');
const bloxAuth = require("@bloxteams/blox-auth");
const OAuth2 = require('./authenticator');
const noblox = require('noblox.js')

const pool = new Pool({
  user: 'postgres',
  host: 'IP removed',
  database: 'universal-union',
  port: 5432
});

const client = new Client({
  user: 'postgres',
  host: 'IP Removed',
  database: 'universal-union',
  port: 5432
});

const divisionList = { // list of division names and their respective group IDs
  "JURY": 5602646,
  "RAZOR": 5602642,
  "SPEAR": 5602645,
  "OTA": 4908428,
  "OSI": 17173828,
}

const CCA_Ranks = { // ranks and their respective abbreviations
  "Recruit": 'RcT',
  "Elite Protection Unit": "EpU",
  "Field Officer": 'OfC',
  "Squadron Leader": 'SqL',
  'Division Leader': 'DvL',
  "Commander": 'CmD',
  "Sectorial Commander": 'SeC'
}


class User { // nain user class 
    constructor(userId) {
      this.userId = userId; // the User class is only initialized using a roblox user id
    }
  
    async getRecords() {
      try {
        const { rows: existingUser } = await pool.query('SELECT * FROM JURY.users WHERE "userId" = $1', [this.userId]); // retrieves the user records (if they exist)
  
        if (!existingUser || existingUser.length === 0) { // if the user has no records, it initializes a new clean data model
          const userData = {
            userId: this.userId,
            warnings: [],
            arrests: [],
            notes: 'N/A',
            lastEdited: {
              prosecutor: 'Server',
              date: Utility.getTodaysDate()
            }
          };
  
          const { rows: insertedUser } = await pool.query( // saves the new data model to the database
            `INSERT INTO jury.users ("userId", warnings, arrests, notes, "lastEdited") VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userData.userId, userData.warnings, userData.arrests, userData.notes, userData.lastEdited]
          );
  
          return insertedUser[0]; // returns new user records
        }
  
        return existingUser[0]; // returns existing user records
      } catch (error) {
        console.error('Error:', error);
        throw error; 
      }
    }

    async getFormattedUsername() {
      let unformattedUsername, formattedUsername, rankInDivision;
      unformattedUsername = await noblox.getUsernameFromId(this.userId) // grabs the users username using their roblox user id

      if (this.userId == 2509926394) return `Advisor ${unformattedUsername}` // if the user is Benefactor, it sets their name to Advisor


      await Promise.all(Object.entries(divisionList).map(async ([divisionName, divisionId]) => { // loops through every divison in the divisionList object
          let role = await noblox.getRankInGroup(divisionId, this.userId) // fetchers user's rank in said group/division (number)
          if (role > 0) { // checks if the user belongs to the group
  
              if (divisionName != 'OTA' && divisionName != 'OSI') { // ignores OSI and OTA members
                rankInDivision = (await noblox.getRole(divisionId, role)).name // gets the user's group role name (using the rank number fetched above)
                rankInDivision = CCA_Ranks[rankInDivision] // grabs the rank abbreviations
                formattedUsername = `CCA.C17.${divisionName}.${rankInDivision}:${unformattedUsername}` 
              } 

          } 
      }))
    

      if (!rankInDivision) { // if the user is not in any division, it checks in the main Universal Union group
        let role = await noblox.getRankInGroup(4904885, this.userId)
        rankInDivision = (await noblox.getRole(4904885, role)).name
  
        if (!rankInDivision.includes('Elite') && rankInDivision.includes(' Protection Unit')) { // if the rank is for example 01 Protection Unit, it removes the "Protection Unit" part - ignoring members ranked EpU
          rankInDivision = rankInDivision.replace(' Protection Unit', '')
        } else rankInDivision = CCA_Ranks[rankInDivision] // if the rank does not contain "protection unit", it grabs the abbreviation for the given rank

        formattedUsername = `CCA.C17.UNION.${rankInDivision}:${unformattedUsername}`// updates the formattedUername variable with the full rank tag
      }

      return formattedUsername // finally, it returns the fully formatted rank tag/name
      
    }

    async addWarning(request, response) { // function responsible for registering warnings
        let article, notes, prosecutor, body, dateOfIssue, expiresOn, editing, id;

        // retrieves data from the sent body
        body = request.body;
        editing = body['warningArticlesEdit']
        article = body.warningArticles || body.warningArticlesEdit;
        notes = body.warningNotes || body.warningNotesEdit;

        prosecutor = (await OAuth2.getUserData(request))["preferred_username"] // gets prosecutor's roblox username using the roblox OAuth2 that the user previously authenticated with
        dateOfIssue = Utility.getTodaysDate()
        expiresOn = Utility.getNextMonth()
        id = editing ? body['warningIdEdit'] : Utility.getUUID() // determines whether the current warning is a new one, or one that's being edited


      let { rows: warningsArray } = await pool.query('SELECT warnings FROM jury.users WHERE "userId" = $1', [this.userId]) // retrives warnings from database
      warningsArray = Array.isArray(warningsArray[0].warnings) ? warningsArray[0].warnings : [] // determines whether the returned "array" is an actual array, if it is - it initializes the variable with the current warnings, if not - it initializes an empty array

      if (editing) { // if the warning is being edited, it removes the warning from the array, and adds the updated one
        warningsArray = warningsArray.map(jsonString => JSON.parse(jsonString))
        warningsArray.forEach(warning => {
          if (warning.id == id) {
            warningsArray = warningsArray.filter(obj => obj.id != id)
            warningsArray.push({
              article,
              dateOfIssue: warning.dateOfIssue,
              prosecutor: warning.prosecutor,
              notes,
              expiresOn: warning.expiresOn,
              id
            })
          }
        })

      } else { // if it's a new warning, it just pushes it to the array
        warningsArray.push({
          article,
          dateOfIssue,
          prosecutor,
          notes,
          expiresOn,
          id
        })
      }

      await pool.query(`UPDATE jury.users SET warnings = $1 WHERE "userId" = $2`, [warningsArray, this.userId]) // updates the existing warning array in the database

      response.redirect(`/profile/${this.userId}`) // redirects user to the profile page of the user that the warning was being issued to

    }


    async addArrest(request, response) { // works on the same principle as the warning function above
      let charges, articles, notes, prosecutor, dateOfIssue, id, body, editing;

      body = request.body;
      editing = body["arrestIdEdit"]
      charges = body["arrestCharges"] || body["arrestChargesEdit"]
      articles = body["arrestArticles"] || body["arrestArticlesEdit"]
      notes = body["arrestNotes"] || body["arrestNotesEdit"]
      prosecutor = (await OAuth2.getUserData(request))["preferred_username"]
      dateOfIssue = Utility.getTodaysDate()
      id = editing ? editing : Utility.getUUID();

      let { rows: arrestsArray } = await pool.query('SELECT arrests FROM jury.users WHERE "userId" = $1', [this.userId])
      arrestsArray = Array.isArray(arrestsArray[0].arrests) ? arrestsArray[0].arrests : []

      if (editing) {
        arrestsArray = arrestsArray.map(jsonString => JSON.parse(jsonString))
        arrestsArray.forEach(arrest => {
          if (arrest.id == id) {
            arrestsArray = arrestsArray.filter(obj => obj.id != id)
            arrestsArray.push({
              charges,
              articles,
              notes,
              prosecutor: arrest.prosecutor,
              dateOfIssue: arrest.dateOfIssue,
              id
            })
          }
        })
      } else {
        arrestsArray.push({
          charges,
          articles,
          notes,
          prosecutor,
          dateOfIssue,
          id
        })
      }

      await pool.query(`UPDATE jury.users SET arrests = $1 WHERE "userId" = $2`, [arrestsArray, this.userId])

      response.redirect(`/profile/${this.userId}`)
    }

    async editNotes(request, response) { // basic function for updating player notes
      let body, notes;

      body = request.body;
      notes = body["notesValue"]

      await pool.query('UPDATE jury.users SET notes = $1 WHERE "userId" = $2', [notes, this.userId])

      response.redirect('/profile/' + this.userId)
    }


    async deleteArrest(request) { // function used for removing existing arrests

      let body, arrestId;
      body = request.body;
      arrestId = body["id"]

      let { rows: arrestsArray } = await pool.query('SELECT arrests FROM jury.users WHERE "userId" = $1', [this.userId]) // retrieves the current arrests
      arrestsArray = arrestsArray[0].arrests
      arrestsArray = arrestsArray.map(v => JSON.parse(v)) // parses the json string into an object

      arrestsArray = arrestsArray.filter(a => a.id != arrestId) // filters out an arrest with the given id

      await pool.query('UPDATE jury.users SET arrests = $1 WHERE "userId" = $2', [arrestsArray, this.userId]) // updates the current arrests in the database

    }

    async deleteWarning(request) { // function works on the same principle as above

      let body, warningId;
      body = request.body;
      warningId = body["id"]
      console.log(warningId)


      let { rows: warningsArray } = await pool.query('SELECT warnings FROM jury.users WHERE "userId" = $1', [this.userId])
      warningsArray = warningsArray[0].warnings
      warningsArray = warningsArray.map(v => JSON.parse(v))

      warningsArray = warningsArray.filter(w => w.id != warningId)

      await pool.query('UPDATE jury.users SET warnings = $1 WHERE "userId" = $2', [warningsArray, this.userId])

      

    }
  }
  
  module.exports = User; // exports the user Class for use in other files

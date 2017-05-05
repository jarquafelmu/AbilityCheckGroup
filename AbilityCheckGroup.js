﻿var AbilityCheckGroup = AbilityCheckGroup ||
(function() {
	"use strict";

	// ReSharper disable once UnusedLocals
	/**
	 * Script information
	 */
	const info = Object.freeze({
		version: "0.9.1",
		created: "4/25/2017",
		lastupdate: "5/5/2017",
		author: "Sam T."
	});

	/**
	 * Useful constants for defining certain parts of the code
	 */
	var fields = {
		feedbackName: "Ability Check Group",
		apiInvoke: "acg"
	};
	
	/**
	 * Send feedback
	 * 
	 * @param {string} msg	The message to send
	 * @param {string} name The a person who should be whispered instead, defaults to gm if
	 *                      left blank but if supplied null it will output to everyone [optional]
	 */
	var sendFeedback = function (msg, name = "gm") {
		let content = `${msg}`;
		content = name !== null ? `/w "${name}" ${content}` : content;

		sendChat(fields.feedbackName, content);
	};

	/**
	 * Alert the GM that there has been an error
	 * 
	 * @param {string} msg	The error message to send
	 */
	var sendError = function (msg, name = "gm") {
		msg = `<span style="color: red; font-weight: bold;">${msg}</span>`;
		if (name !== null) {
			sendFeedback(msg, name);
		} else {
			sendFeedback(msg);	
		}
	}; 

	/**
	 * Contains methods which interact directly with the token or journal.
	 */
	var token = (function () {
		/**
		 * Checks if a valid token exists in selection, returns first match.
		 * 
		 * Sends an error message if the currently selected item is not a token or if there is nothing being selected.
		 * 
		 * @param {any} selection the selected object
		 *
		 * @return an object representing a token, otherwise null.
		 */
		var getTokenObj = function (selection) {
			var graphic;
			if (!selection ||
				selection.length !== 1 ||
				// ReSharper disable once UsageOfPossiblyUnassignedValue
				// ReSharper disable once QualifiedExpressionIsNull
				// ReSharper disable once PossiblyUnassignedProperty
				!(graphic = getObj("graphic", selection[0]._id) || graphic.get("_subtype") !== "token") ||
				graphic.get("isdrawing"))
			{
				return null;
			}

			return getObj("graphic", selection[0]._id);
		};

		/**
		 * check if the character object exists, return first match
		 *
		 * @param {string} name	attribute name
		 * @param {string} type the type of the attribute
		 * @param {string} id the character id
		 *
		 * @return returns first match
		 */
		var characterObjExists = function(name, type, charId) {
			var retval = null;
			const obj = findObjs({
				_type: type,
				name: name,
				_characterid: charId
			});
			if (obj.length > 0) {
				retval = obj[0];
			}
			return retval;
		};

		/**
		 * Retrieves the value for the attribute
		 * 
		 * @param {any} attribute the attribute
		 *
		 * @return the attribute value, otherwise null.
		 */
		const getAttributeValue = function(attribute)
		{
			if (attribute) {
				return attribute.get("current");
			} else {
				return null;
			}
		}

		/**
		 * Gets the character journal object for which the token represents.
		 * 
		 * @param {any} selection The currently selected token
		 * @return the character journal if any is found, otherwise null.
		 */
		const getCharacterJournal = function(selection) {
			const curToken = getTokenObj(selection);
			if (!curToken) {
				return null;
			}

			const journal = getObj("character", curToken.get("represents"));
			if (journal) {
				const id = journal.get("_id");
				const name = getAttributeValue(characterObjExists("name", "attribute", id)) || journal.get("name");
				const isNpc = getAttributeValue(characterObjExists("npc", "attribute", id)) === "1";

				return { name: name, id: id, isNpc: isNpc};
			}

			return null;
		};

		/**
		 * Checks to see if the Attribute exists for the NPC.
		 * 
		 * @param {any} id id of the journal to check
		 * @param {any} attribute npc attribute to check
		 *
		 * @return true if attribute exists, otherwise false.
		 */
		const useNpcAttributeName = function (id, attribute) {
			const result = parseInt(getAttributeValue(characterObjExists(`${attribute}_flag`, "attribute", id)));
			return result > 0;
		};

		/**
		 * Public functions
		*/
		return {
			getCharacterJournal: getCharacterJournal,
			useNpcAttributeName: useNpcAttributeName
	};
	}());

	/**
	 * Contains methods which handles building the response body to the user
	 */
	const responseHandler = (function () {
		/**
		 * Contains a series of response templates including buttons and response bodies.
		 */
		const templates = (function () {
			return {
				rollTemplateMain: function(title, content) {
					return `&{template:desc} {{desc=**${title}**<br>${content}}}`;
				},
				rollTemplateChecks: function (title, skills, basic) {
					let rollTemplate = `&{template:desc} {{desc=**${title}**<br>`;
					rollTemplate += skills.content.length > 0 ? `${skills.title}<br>${skills.content}<br>` : "";
					rollTemplate += `${basic.title}<br>${basic.content}}}`;
					return rollTemplate;
				},
				macrobutton: function (label, keyword, abilityName) {
					return `[${label}](~${keyword}|${abilityName})`;
				},
				apibutton: function (label, command) {
					return `[${label}](!${fields.apiInvoke} -${command})`;
				}
			};
		}());

		/**
		 * Contains a dictionary which relates the names of attributes to which skills they govern 
		 */
		var abilityGroups = Object.freeze({
			str: {
				short: "Str",
				proper: "Strength",
				skills: ["Athletics"]
			},
			dex: {
				short: "Dex",
				proper: "Dexterity",
				skills: [
					"Acrobatics",
					"Sleight of Hand",
					"Stealth"
				]
			},
			con: {
				short: "Con",
				proper: "Constitution",
				skills: []
			},
			int: {
				short: "Int",
				proper: "Intelligence",
				skills: [
					"Arcana",
					"History",
					"Investigation",
					"Nature",
					"Religion"
				]
			},
			wis: {
				short: "Wis",
				proper: "Wisdom",
				skills: [
					"Animal Handling",
					"Insight",
					"Medicine",
					"Perception",
					"Survival"
				]
			},
			cha: {
				short: "Cha",
				proper: "Charisma",
				skills: [
					"Deception",
					"Intimidation",
					"Performance",
					"Persuasion"
				]
			}
		});

		/**
		 * Converts the string to lowercase and replaces spaces with underscores
		 * 
		 * @param {any} str
		 */
		var toSnakeCase = function(str) {
			return str.toLowerCase().replace(/\s+/g, "_");
		};

		/**
		 * Builds the General check button, which just uses the character's attribute modifier
		 * 
		 * @param {any} json contains json corresponding with the requested attribute
		 * @param {any} character A character object containing its name, its status as an npc, and its id
		 */
		const buildGeneralButton = function (json, who) {
			const lower = json.proper.toLowerCase();

			const base = who.isNpc ? toSnakeCase(`npc ${json.short.toLowerCase()}`) : lower;

			return templates.macrobutton("General", who.id, base);
		}

		/**
		 * Builds the saving throw button
		 *
		 * @param {any} json contains json corresponding with the requested attribute
		 * @param {any} character A character object containing its name, its status as an npc, and its id
		 */
		const buildSaveButton = function (json, character) {
			log("Entered buildSaveButton");
			const lower = json.proper.toLowerCase();

			let saveName = toSnakeCase(`${lower} save`);
			if (character.isNpc) {
				const npcAttribute = toSnakeCase(`npc ${json.short.toLowerCase()} save`);
				saveName = token.useNpcAttributeName(character.id, npcAttribute) ? npcAttribute : saveName;
			}

			return templates.macrobutton("Save", character.id, saveName);
		}

		/**
		 * Builds the skill button for the current skill
		 * 
		 * @param {any} skill the skill needed to be built
		 * @param {any} character A character object containing its name, its status as an npc, and its id
		 */
		const buildSkillButton = function(skill, who) {
			let skillName = toSnakeCase(skill);
			if (who.isNpc) {
				const npcAttribute = toSnakeCase(`npc ${skillName}`);
				skillName = token.useNpcAttributeName(who.id, npcAttribute) ? npcAttribute : skillName;
			}

			return `${templates.macrobutton(skill, who.id, skillName)} `;
		}

		/**
		 * Creates the response json which contains the general buttons and skill buttons
		 * 
		 * @param {any} attr the attribute to be built str|dex|con|int|wis|cha
		 * @param {any} character A character object containing its name, its status as an npc, and its id
		 */
		var buildResponseJson = function (attr, character) {
			const json = {
				title: "",
				basic: {
					title: "",
					content: ""
				},
				skills: {
					title: "",
					content: ""
				}
			};

			// ensure that the attribute actually exists
			if (!abilityGroups.hasOwnProperty(attr)) {
				throw `"${attr}" is not a valid attribute.`;
			}
			
			const abilityGroup = abilityGroups[attr];

			// build attributes section
			json.title = `${abilityGroup.proper} Checks`;

			json.basic.title = `Basics`;

			let rollGroup = `${buildGeneralButton(abilityGroup, character)} ${buildSaveButton(abilityGroup, character)}`;

			json.basic.content = rollGroup.trim();

			// build skills section
			const skillList = abilityGroup.skills;
			json.skills.title = `Skills`;

			rollGroup = "";
			skillList.forEach(function (skill) {
				rollGroup += buildSkillButton(skill, character);
			});

			json.skills.content = rollGroup.trim();

			return json;
		};

		/**
		 * Builds the initial response which contains buttons for the six attributes.
		 *
		 * @param {any} character A character object containing its name, its status as an npc, and its id
		 */
		const doMainResponse = function (character) {
			let content = "";

			for (let key in abilityGroups) {
				if (abilityGroups.hasOwnProperty(key)) {
					const item = abilityGroups[key];
					content += templates.apibutton(item.short, item.short.toLowerCase());
					if (key === "con") {
						content += "<br>";
					}
				}
			}
			
			content = templates.rollTemplateMain("Ability Checks", content.trim());

			sendFeedback(content, character.name);
		};

		/**
		 * Builds the attribute response body. Which includes a general check, a saving thow and skills, if any.
		 * 
		 * @param {any} attr the requested attribute
		 * @param {any} character the person who will receive the response
		 */
		const doAttributeResponse = function (attr, character) {
			try {
				const json = buildResponseJson(attr, character);

				const content = templates.rollTemplateChecks(json.title, json.skills, json.basic);

				sendFeedback(content, character.name);
			} catch (err) {
				sendError(err);
			}
		};

		return {
			doMainResponse: doMainResponse,
			doAttributeResponse: doAttributeResponse
		};
	}());

	/**
	 * Returns the requested attribute from the input string
	 * 
	 * @param {any} input
	 */
	var getAttributeType = function (input) {
		return input.match(/-(\w+)/)[1];
	};

	/**
	 * Handles the user input
	 * @param {any} msg
	 */
	var handleInput = function(msg) {
		var args = msg.content;
		const selection = msg.selected;
		const sender = msg.who.replace(" (GM)", "");

		if (msg.type !== "api") {
			return;
		}

		if (args.indexOf(`!${fields.apiInvoke}`, "") === 0) { // ensure that we are actually being called
			args = args.replace(`!${fields.apiInvoke}`, "").trim();

			const character = token.getCharacterJournal(selection);
			if (!character) {
				sendError("Invalid selection", sender);
				return;
			}

			if (args.length !== 0) {
				if (args.indexOf("-main") === 0) {
					responseHandler.doMainResponse(character);
				} else {
					const attribute = getAttributeType(args);

					responseHandler.doAttributeResponse(attribute, character);
				}
			}
		}
	};

	/**
	 * Registers events which launch this script
	 */
	const registerEventHandlers = function() {
		on("chat:message", handleInput);
	};

	/**
	 * Alerts the log that this script is fully loaded
	 */
	const ready = function() {
		log("Attributes and Skills Book ready.");
	};

	return {
		Ready: ready,
		RegisterEventHandlers: registerEventHandlers
	};
}());

on("ready", function () {
	"use strict";
	AbilityCheckGroup.RegisterEventHandlers();
	AbilityCheckGroup.Ready();
});
import {detachConfig} from "../../application/utils/ConfigUtils.js";

let defaultConf =                 {
    "pos": [0, 0, 0],
    "visibility": 1,
    "grid_id": "grid_7x7",
    "host_id": "bandit_basic",
    "auto_equip": true,
    "indicator_id": "battle_indicator",
    "trigger_radius": 2,
    "interact_options": [
        {"interaction": "FIGHT", "text": "Attack", "dispatch":  {
                "event":"ENCOUNTER_ENGAGE", "value":{}}
        },
        {"interaction": "PARTY", "text": "Help me here!", "dispatch":  {
                "event":"ENCOUNTER_PARTY", "value":{"broadcast": "Someone help me? (Dynamic Encounter)"}}
        },
        {"interaction": "TALK",  "text": "Hi! Please go away so I can pass", "dispatch":  {
                "event":"ENCOUNTER_CONVERSE", "value":{"skip": true}}
        },
        {"interaction": "LEAVE", "text": "Sorry to disturb you, just leaving."}
    ],
    "spawn": {
        "patterns": [
            {
                "pattern_id":"sp_pair_row",
                "tile": [4, 4],
                "population_id": "DEFAULT_POPULATION"
            }
        ],
        "actors": [
            {
                "actor": "ACTOR_FIGHTER",
                "rot": [0, 1.2, 0],
                "on_ground": true,
                "tile": [4, 4]
            },
        ]
    }
}

class ProceduralEncounterConfig {
    constructor() {
        this.config = {

        }
    }

    generateConfig(pos, encounterLevel, groundData, terrainData) {
    //    console.log("generateConfig", pos, groundData, terrainData);
        this.config = detachConfig(defaultConf);
        MATH.vec3ToArray(pos, this.config.pos, 1);
        MATH.vec3FromArray(this.config.pos, pos);
        this.config.pos[1] = MATH.decimalify(ThreeAPI.terrainAt(pos), 10);
        this.config['level'] = encounterLevel;
    }

    setConfig(conf) {
        this.config = detachConfig(conf);
    }

}

export { ProceduralEncounterConfig }
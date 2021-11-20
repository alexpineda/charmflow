const Eris = require("eris");
const CharmFlow = require("./main");
const Constants = Eris.Constants;

var bot = new Eris.CommandClient(process.env.DISCORD_BOT_TOKEN);
bot.on("ready", () => {
  console.log("eris: ready");
  for (const [key, guild] of bot.guilds) {
    guild.bulkEditCommands([
      {
        name: "configure",
        description: "Configure iCalbot",
        type: Constants.ApplicationCommandTypes.CHAT_INPUT
      }
    ]);
  }
});

const charmFlow = new CharmFlow(bot);
charmFlow
  .onCommand("configure") // handle the configure command
  .restrict(["initiator"]) // only the user who initiated can continue
  .flow( async (interaction) => { // Eris.CommandInteraction or Eris.ComponentInteraction
    return await interaction.createFollowup({ 
      content: "Where should iCalbot send event notifications?",
      components: [
        {
          type: Constants.ComponentTypes.ACTION_ROW,
          components: [
            {
              type: Constants.ComponentTypes.SELECT_MENU,
              custom_id: "message_types",
              placeholder: "Message Types",
              options: [
                {
                  label: "Discord Events",
                  value: "events",
                  description: "Use Discord's new event feature"
                },
                {
                  label: "Channel Message",
                  value: "message",
                  description: "Send event messages to a channel"
                }
              ],
              min_values: 1,
              max_values: 2
            }
          ]
        }
      ]
    });
  })
   // from now on chain flow() to handle results and send additional messages
  .flow(async (interaction) => {
    if (interaction.data && interaction.data.values.includes("message")) {
      // create a new flow that will be handled next before continuing the parent flow
      flow( interaction => {
        return interaction.createFollowup({
          content: "What channel should we send messages to?",
          components: [
            {
              type: Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Constants.ComponentTypes.SELECT_MENU,
                  custom_id: "channels",
                  placeholder: "Channels",
                  options: [
                    {
                      label: "Channel 1",
                      value: "c1"
                    },
                    {
                      label: "Channel 2",
                      value: "c2"
                    }
                  ],
                  min_values: 1,
                  max_values: 2
                }
              ]
            }
          ]
        });
      }).flow(async (interaction) => {
        return await interaction.createMessage(
          `sending to channels ${ interaction.data.values.join(',')}`
        )
      }).end(); // required: end() -> end the flow
    } else {
      flow(async (interaction) => {
        return await interaction.createMessage(
          "not sending to channels"
        )
      }).end();
    }
  }) // if flows don't return a message (createFollowup) they pass through the previous interaction
  .flow(async interaction => {
    await interaction.createMessage("bye!");
  })
  .keepPreviousMessage()
  .deleteMessages()
  .end()

bot.connect(); // Get the bot to connect to Discord

const Eris = require("eris");
const CharmFlow = require("../src/index");
const Constants = Eris.Constants;

// setup the client
var bot = new Eris.CommandClient(process.env.DISCORD_BOT_TOKEN);
bot.on("ready", () => {
  console.log("eris: ready");
  for (const [, guild] of bot.guilds) {
    guild.bulkEditCommands([
      {
        name: "configure",
        description: "Configure iCalbot",
        type: Constants.ApplicationCommandTypes.CHAT_INPUT
      }
    ]);
  }
});

// setup the flow
const charmFlow = new CharmFlow(bot);
charmFlow
  .onCommand("configure") // handle the configure command
  .flow( interaction => { // Eris.CommandInteraction
    return interaction.createFollowup({ 
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
  .flow(async (interaction, flow) => { // Eris.CommandInteraction
    // if the user selected a message option, spawn the subflow to be handled before continuing this top flow
    if (interaction.data && interaction.data.values.includes("message")) {
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
      }).end((interaction) => {
        return interaction.createFollowup(
          `sending to channels ${ interaction.data.values.join(',')}`
        )
      });
    } else {
      // note: you don't actually have to return anything if you don't want to!
      return await interaction.createFollowup(
        "not sending to channels"
      )
    }
  })
  .flow(async interaction => interaction.createFollowup("bye!"))
  .keepMessage() // keep the "bye!"
  .deleteMessages()
  .end()

bot.connect(); // Get the bot to connect to Discord

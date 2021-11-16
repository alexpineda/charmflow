import {
    CommandClient,
    CommandInteraction,
    ComponentInteraction,
    ComponentInteractionButtonData,
    ComponentInteractionSelectMenuData,
    Constants,
} from "eris";

import CharmFlow from ".";

// A contrived example

const charm = new CharmFlow(new CommandClient("", { intents: 0 }));

// utility functions for typescript
function isMenuData(
  data: ComponentInteractionSelectMenuData | ComponentInteractionButtonData
): data is ComponentInteractionSelectMenuData {
  return Array.isArray((data as ComponentInteractionSelectMenuData).values);
}

// create a flow template starting with onCommand().start()
charm
  .onCommand("configure", {
    restrict: ["owner", "server-manager"],
    timeout: 30000,
    deleteAfterEach: false
  }) 
  .start( async (interaction: CommandInteraction) => {
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
                  description: "Use Discord's new event feature",
                },
                {
                  label: "Channel Message",
                  value: "message",
                  description: "Send event messages to a channel",
                },
              ],
              min_values: 1,
              max_values: 2,
              disabled: false,
            },
          ],
        },
      ],
    });
  })
  .flow(async (interaction, flow) => {
    if (
      isMenuData(interaction.data) &&
      interaction.data.values.includes("messages")
    ) {
        // can have if else statements with waitFor, where each will be added to a stack and completed before continuing
        flow(async (interaction) => {
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
                            value: "c1",
                          },
                          {
                            label: "Channel 2",
                            value: "c2",
                          },
                        ],
                        min_values: 1,
                        max_values: 1,
                      },
                    ],
                  },
                ],
              })
        }).end()
    }
  })
  .flow( async (interaction: ComponentInteraction) => {
    await interaction.deleteOriginalMessage();
    interaction.createMessage({
      content: "iCalbot Configured!",
      flags: Constants.MessageFlags.EPHEMERAL,
    });
  })
  .end();
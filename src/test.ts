import { CommandInteraction, ComponentInteraction, Constants } from "eris";
import { EventEmitter } from "events";

import Charm from ".";

class TestCommandInteraction extends CommandInteraction {
    
}

jest.mock("eris", () => {
    // const og = jest.requireActual("eris"); // Step 2.
    return {
        // ...og,
        CommandInteraction: jest.fn(),
    };
});



describe("CharmFlow", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });
  
  test("Happy Path", async () => {
    const emitter = new EventEmitter();
    const charm = new Charm(emitter);
    const builder = charm.onCommand("test");
    builder
      .start(async (interaction: CommandInteraction) => {
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
      .flow(async (interaction: ComponentInteraction) => {
        return interaction.createFollowup({
          content: "hi",
        });
      })
      .flow(async (interaction: ComponentInteraction) => {
        interaction.createMessage({
          content: "bye",
        });
      })
      .end();

     
    (CommandInteraction as unknown as jest.Mock).mockImplementation(() => {
      const og = Object.create(jest.requireActual("eris").CommandInteraction.prototype);
      return og;
  })

    const interaction = new CommandInteraction("testId");
    //@ts-ignore
    interaction.data = { name: "test" };
    emitter.emit("interactionCreate", interaction);
  });

  test("Must use start() first", () => {
    const emitter = new EventEmitter();
    const charm = new Charm(emitter);
    const builder = charm.onCommand("test");
    builder
      .flow(async (interaction: ComponentInteraction) => {
        interaction.createMessage({
          content: "bye",
        });
      })
      .end();
  });

  // test("Must return message+commands with start()", () => {
  //     const emitter = new EventEmitter();
  //     const charm = new Charm(emitter);
  //     const builder = charm.onCommand("test");
  //     builder.start(async (interaction: CommandInteraction) => {
  //         return interaction.createFollowup({
  //             content: "hi"
  //         });
  //     }).flow().end();

  // })
});

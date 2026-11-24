{
  description = "monorepo-template: development toolchain and local infrastructure";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      # Terraform is unfree (bsl11); allow that single package explicitly.
      packagesFor =
        system:
        import nixpkgs {
          inherit system;
          config.allowUnfreePredicate = pkg: nixpkgs.lib.getName pkg == "terraform";
        };
      infrastructure =
        pkgs:
        pkgs.writeShellApplication {
          name = "dev-infra";
          runtimeInputs = [
            pkgs.git
            pkgs.postgresql
            pkgs.redis
          ];
          text = builtins.readFile ./tooling/dev-infra.sh;
        };
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = packagesFor system;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              git
              hk
              nodejs_24
              postgresql
              redis
              terraform
            ];
          };
        }
      );

      formatter = forAllSystems (system: (packagesFor system).nixfmt);

      apps = forAllSystems (system: {
        dev-infra = {
          type = "app";
          program = "${infrastructure (packagesFor system)}/bin/dev-infra";
          meta.description = "Start, stop or inspect the local PostgreSQL and Redis services";
        };
      });
    };
}

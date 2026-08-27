"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface GooglePlace {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  place_id: string;
  formatted_address: string;
  geometry?: {
    location: {
      lat: number | (() => number);
      lng: number | (() => number);
    };
  };
  url?: string; // Google Maps URL
}

interface GooglePlacesAutocompleteProps {
  onAddressSelect: (address: string, place: PlaceDetails) => void;
  onClear?: () => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export function GooglePlacesAutocomplete({
  onAddressSelect,
  onClear,
  onInputChange,
  placeholder = "Buscar dirección...",
  defaultValue = "",
  value,
  disabled = false,
  className = "",
}: GooglePlacesAutocompleteProps) {
  const [query, setQuery] = useState(value || defaultValue);
  const [predictions, setPredictions] = useState<GooglePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const useNewPlacesApi = useRef(false);
  const selectionRef = useRef<{ isSelecting: boolean; value: string | null }>({
    isSelecting: false,
    value: null,
  });
  const { toast } = useToast();

  const ensurePlacesLibrary = async () => {
    if (!window.google?.maps) return false;
    if (window.google.maps.places) return true;

    if (typeof window.google.maps.importLibrary === "function") {
      try {
        await window.google.maps.importLibrary("places");
      } catch (error) {
        console.error("Error cargando la librería de Places:", error);
      }
    }

    return Boolean(window.google.maps.places);
  };

  // Sync query with external value changes
  useEffect(() => {
    setQuery(value !== undefined ? value : defaultValue);
  }, [value, defaultValue]);
  useEffect(() => {
    const initialize = async () => {
      const ready = await ensurePlacesLibrary();
      if (!ready) return;
      setIsScriptLoaded(true);
      initializeServices();
    };

    if (window.google) {
      void initialize();
      return;
    }

    const handleLoaded = () => {
      void initialize();
    };

    const handleError = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cargar Google Maps API",
      });
    };

    window.addEventListener("google-maps-loaded", handleLoaded, { once: true });
    window.addEventListener("google-maps-error", handleError, { once: true });

    return () => {
      window.removeEventListener("google-maps-loaded", handleLoaded);
      window.removeEventListener("google-maps-error", handleError);
    };
  // Registro único de listeners de window al montar; depender de `toast`
  // duplicaría los handlers cada vez que cambie el estado de notificaciones.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeServices = () => {
    if (!window.google?.maps?.places) return;

    useNewPlacesApi.current = !!window.google?.maps?.places?.AutocompleteSuggestion;
    if (!useNewPlacesApi.current) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      // Crear un div temporal para el PlacesService
      const tempDiv = document.createElement("div");
      placesService.current = new window.google.maps.places.PlacesService(tempDiv);
    }
  };

  // Buscar predicciones cuando cambia el query
  useEffect(() => {
    if (
      !query ||
      query.length < 3 ||
      !isScriptLoaded ||
      (!useNewPlacesApi.current && !autocompleteService.current)
    ) {
      setPredictions([]);
      return;
    }

    if (selectionRef.current.isSelecting && selectionRef.current.value === query) {
      selectionRef.current.isSelecting = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsLoading(true);

      if (useNewPlacesApi.current) {
        window.google.maps.places.AutocompleteSuggestion
          .fetchAutocompleteSuggestions({
            input: query,
          })
          .then((response: any) => {
            const suggestions = (response?.suggestions ?? [])
              .map((item: any) => item?.placePrediction)
              .filter(Boolean)
              .map((prediction: any) => ({
                place_id: prediction.placeId,
                description:
                  prediction.text?.text ||
                  prediction.text ||
                  prediction.structuredFormat?.mainText?.text ||
                  "",
                structured_formatting: {
                  main_text:
                    prediction.structuredFormat?.mainText?.text ||
                    prediction.text?.text ||
                    "",
                  secondary_text:
                    prediction.structuredFormat?.secondaryText?.text || "",
                },
              }));

            setPredictions(suggestions);
            setShowPredictions(suggestions.length > 0);
          })
          .catch((error: Error) => {
            console.error("Error obteniendo sugerencias:", error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "No se pudieron obtener sugerencias de direcciones",
            });
            setPredictions([]);
          })
          .finally(() => {
            setIsLoading(false);
          });
        return;
      }

      autocompleteService.current.getPlacePredictions(
        {
          input: query,
          types: ["address"],
        },
        (predictions: GooglePlace[] | null, status: string) => {
          setIsLoading(false);

          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setPredictions(predictions);
            setShowPredictions(true);
          } else {
            setPredictions([]);
            if (status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              console.warn("Places Autocomplete status:", status);
            }
          }
        }
      );
    }, 300);

    return () => clearTimeout(timeoutId);
  // Debounce de búsqueda: solo debe reaccionar a `query` e `isScriptLoaded`.
  // `toast` es estable y reiniciaría el temporizador sin motivo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isScriptLoaded]);

  const handlePlaceSelect = async (place: GooglePlace) => {
    setIsLoading(true);
    setShowPredictions(false);

    try {
      if (useNewPlacesApi.current && window.google?.maps?.places?.Place) {
        const placeInstance = new window.google.maps.places.Place({
          id: place.place_id,
        });

        await placeInstance.fetchFields({
          fields: ["id", "formattedAddress", "location", "googleMapsURI"],
        });

        const details: PlaceDetails = {
          place_id: place.place_id,
          formatted_address: placeInstance.formattedAddress || place.description,
          geometry: placeInstance.location
            ? {
                location: {
                  lat: () => placeInstance.location.lat(),
                  lng: () => placeInstance.location.lng(),
                },
              }
            : undefined,
          url: placeInstance.googleMapsURI,
        };

        const displayAddress = place.description || details.formatted_address || "";
        selectionRef.current = { isSelecting: true, value: displayAddress };
        setQuery(displayAddress);
        setPredictions([]);
        setShowPredictions(false);
        onAddressSelect(displayAddress, details);
        return;
      }

      if (!placesService.current) {
        throw new Error("PlacesService no disponible");
      }

      const details = await new Promise<PlaceDetails>((resolve, reject) => {
        placesService.current.getDetails(
          {
            placeId: place.place_id,
            fields: ["place_id", "formatted_address", "geometry", "url"],
          },
          (result: PlaceDetails, status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK) {
              resolve(result);
            } else {
              reject(new Error("No se pudieron obtener los detalles del lugar"));
            }
          }
        );
      });

      const displayAddress = place.description || details.formatted_address;
      selectionRef.current = { isSelecting: true, value: displayAddress };
      setQuery(displayAddress);
      setPredictions([]);
      setShowPredictions(false);
      onAddressSelect(displayAddress, details);
    } catch (error) {
      console.error("Error obteniendo detalles del lugar:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo obtener la información de la dirección",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setPredictions([]);
    setShowPredictions(false);
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowPredictions(false);
    }
  };

  // Cerrar predicciones cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync query with external value changes
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value, query]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            onInputChange?.(nextValue);
            // Clear predictions when typing
            if (nextValue === "") {
              setPredictions([]);
              setShowPredictions(false);
            }
          }}
          onFocus={() => query && predictions.length > 0 && setShowPredictions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-20 ${className}`}
        />
        
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          {isLoading || !isScriptLoaded ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Lista de predicciones */}
      {showPredictions && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => handlePlaceSelect(prediction)}
              className="w-full px-3 py-2 text-left hover:bg-accent/25 flex items-start gap-2 transition-colors"
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {prediction.structured_formatting.main_text}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {prediction.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

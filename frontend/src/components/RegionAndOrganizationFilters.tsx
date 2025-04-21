import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useAuthContext } from 'context';
import {
  // Accordion,
  // AccordionDetails,
  // AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  List,
  ListItem,
  TextField,
  // Typography,
  Stack
} from '@mui/material';
// import { ExpandMore } from '@mui/icons-material';
import { useStaticsContext } from 'context/StaticsContext';
import {
  ORGANIZATION_EXCLUSIONS,
  REGIONAL_USER_CAN_SEARCH_OTHER_REGIONS
} from 'hooks/useUserTypeFilters';
import { SearchBar } from './SearchBar';
import { useHistory, useLocation } from 'react-router-dom';
import { set } from 'date-fns';
// import { FilterTags } from 'pages/Search/FilterTags';

const GLOBAL_ADMIN = 3;
const REGIONAL_ADMIN = 2;
const STANDARD_USER = 1;

// Swap this value to allow regional admin to filter on regions that aren't their own
export const toggleRegionalUserType = true;

export const REGION_FILTER_KEY = 'organization.regionId';
export const ORGANIZATION_FILTER_KEY = 'organizationId';

export interface OrganizationShallow {
  regionId: string;
  name: string;
  id: string;
  rootDomains: string[];
}

interface RegionAndOrganizationFiltersProps {
  addFilter: (
    name: string,
    value: any,
    filterType: 'all' | 'any' | 'none'
  ) => void;
  removeFilter: (
    name: string,
    value: any,
    filterType: 'all' | 'any' | 'none'
  ) => void;
  filters: any[];
  setSearchTerm: (s: string, opts?: any) => void;
  searchTerm: string;
  results?: any;
}

export const RegionAndOrganizationFilters: React.FC<
  RegionAndOrganizationFiltersProps
> = ({
  addFilter,
  removeFilter,
  filters,
  searchTerm: domainSearchTerm,
  setSearchTerm: setDomainSearchTerm,
  results
}) => {
  console.log('results', results);
  const { setShowMaps, user, apiPost } = useAuthContext();

  const { regions } = useStaticsContext();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [orgResults, setOrgResults] = useState<OrganizationShallow[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  let userLevel = 0;
  if (user && user.isRegistered) {
    if (user.userType === 'standard') {
      userLevel = STANDARD_USER;
    } else if (user.userType === 'globalAdmin') {
      userLevel = GLOBAL_ADMIN;
    } else if (
      user.userType === 'regionalAdmin' ||
      user.userType === 'globalView'
    ) {
      userLevel = REGIONAL_ADMIN;
    }
  }

  const searchOrganizations = useCallback(
    async (searchTerm: string, regions?: string[]) => {
      try {
        const results = await apiPost<{
          body: { hits: { hits: { _source: OrganizationShallow }[] } };
        }>('/search/organizations', {
          body: {
            searchTerm,
            regions
          }
        });

        const orgs = results.body.hits.hits.map((hit) => hit._source);
        // Filter out organizations that match the exclusions
        const refinedOrgs = orgs.filter((org) => {
          let exlude = false;
          ORGANIZATION_EXCLUSIONS.forEach((exc) => {
            if (org.name.toLowerCase().includes(exc)) {
              exlude = true;
            }
          });
          return !exlude;
        });
        // Filter out organizations that are already in the filters
        const filteredOrgs = refinedOrgs.filter(
          (org) =>
            !filters.find(
              (filter) =>
                filter.field === ORGANIZATION_FILTER_KEY &&
                filter.values.find(
                  (value: { id: string }) => value.id === org.id
                )
            )
        );
        // Sort filtered orgs by name
        const sortedOrgs = filteredOrgs.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        // Utility function to replce HTML encodings
        const decodeHtml = (orgName: string): string => {
          const encodings: { [key: string]: string } = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'"
          };
          return orgName.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, (m) => {
            return encodings[m];
          });
        };
        // Decode HTML encodings in org names
        sortedOrgs.forEach((org) => {
          org.name = decodeHtml(org.name);
        });

        setOrgResults(sortedOrgs);
      } catch (e) {
        console.log(e);
      }
    },
    [apiPost, setOrgResults, filters]
  );

  const regionFilterValues = useMemo(() => {
    const regionFilter = filters.find(
      (filter) => filter.field === REGION_FILTER_KEY
    );
    if (regionFilter !== undefined) {
      return regionFilter.values as string[];
    }
    return null;
  }, [filters]);

  const handleCheckboxChange = (regionId: string) => {
    if (regionFilterValues?.includes(regionId)) {
      removeFilter(REGION_FILTER_KEY, regionId, 'any');
    } else {
      addFilter(REGION_FILTER_KEY, regionId, 'any');
    }
  };

  const handleTextChange = (v: string) => {
    setSearchTerm(v);
  };

  useEffect(() => {
    searchOrganizations(searchTerm, regionFilterValues ?? []);
  }, [searchOrganizations, searchTerm, regionFilterValues]);

  const organizationsInFilters = useMemo(() => {
    const orgsFilter = filters.find(
      (filter) => filter.field === ORGANIZATION_FILTER_KEY
    );
    if (orgsFilter !== undefined) {
      return orgsFilter.values as OrganizationShallow[];
    } else {
      return null;
    }
  }, [filters]);

  const showUsersRegionDisabled = useMemo(() => {
    return (
      (userLevel === STANDARD_USER ||
        (!REGIONAL_USER_CAN_SEARCH_OTHER_REGIONS &&
          userLevel !== GLOBAL_ADMIN)) &&
      user?.regionId
    );
  }, [user?.regionId, userLevel]);

  const regionExistsInFilters = useCallback(
    (regionId: string) => {
      return regionFilterValues?.includes(regionId);
    },
    [regionFilterValues]
  );
  const history = useHistory();
  const location = useLocation();

  const handleAddOrganization = (org: OrganizationShallow) => {
    if (org) {
      const exists = organizationsInFilters?.find((o) => o.id === org.id);
      if (exists) {
        removeFilter(ORGANIZATION_FILTER_KEY, org, 'any');
      } else {
        addFilter(ORGANIZATION_FILTER_KEY, org, 'any');
      }
      setSearchTerm('');
      setIsOpen(false);
      if (org.name === 'Election') {
        setShowMaps(true);
      } else {
        setShowMaps(false);
      }
    } else {
    }
  };

  const domainNamesAndIps: { name: string; ip: string }[] = useMemo(() => {
    if (!results) return [];
    return results.map((result: any) => {
      let domainName = '';
      let domainIp = '';
      if (typeof result.name === 'object' && result.name !== null) {
        domainName = result.name.raw || '';
      } else {
        domainName = result.name || '';
      }
      if (typeof result.ip === 'object' && result.ip !== null) {
        domainIp = result.ip.raw || '';
      } else {
        domainIp = result.ip || '';
      }
      return { name: domainName, ip: domainIp };
    });
  }, [results]);

  console.log('domainNamesAndIps', domainNamesAndIps);

  // const applyFilters = () => {
  //   setDomainSearchTerm(searchTerm, {
  //     shouldClearFilters: false,
  //     refresh: true
  //   });
  // };
  // const resetFilters = () => {
  //   setDomainSearchTerm('', {
  //     shouldClearFilters: true,
  //     refresh: true
  //   });
  //   setSearchTerm('');
  // };

  return (
    <>
      <Divider />
      <Box padding={2}>
        <Autocomplete
          options={domainNamesAndIps}
          getOptionLabel={(option) => `${option.name} (${option.ip})`}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Domain"
              onBlur={() => setIsOpen(false)}
              disabled={userLevel === STANDARD_USER}
            />
          )}
          onChange={(_, v) => {
            if (v && location.pathname !== '/inventory') {
              history.push(`/inventory?q=${v.name}`);
              setDomainSearchTerm(v.name, {
                shouldClearFilters: false
              });
            }
          }}
          onInputChange={(event, value, reason) => {
            if (reason === 'clear') {
              setDomainSearchTerm('', {
                shouldClearFilters: false
                // refresh: true
              });
            } else if (event && event.type === 'change') {
              setDomainSearchTerm(value, {
                shouldClearFilters: false
              });
            }
          }}
        />
        <SearchBar
          initialValue={domainSearchTerm}
          value={domainSearchTerm}
          onChange={(value) => {
            if (location.pathname !== '/inventory') {
              history.push(`/inventory?q=${value}`);
              setDomainSearchTerm(typeof value === 'string' ? value : '', {
                shouldClearFilters: false,
                refresh: true
              });
            }
            setDomainSearchTerm(typeof value === 'string' ? value : '', {
              shouldClearFilters: false
            });
          }}
        />
      </Box>
      <Divider />
      <Box padding={2}>
        <Autocomplete
          options={regions.map((region) => `Region ${region}`)}
          // defaultValue={`Region ${user?.regionId}`}
          onChange={(e, selectedRegion) => {
            const exists = regionFilterValues?.find(
              (regionId) => regionId === selectedRegion?.replace('Region ', '')
            );
            if (exists) {
              return;
            } else {
              addFilter(
                REGION_FILTER_KEY,
                selectedRegion?.replace('Region ', ''),
                'any'
              );
            }
            setTimeout(() => {
              setIsOpen(false);
            }, 250);
          }}
          // renderOption={(props, option) => (
          //   <li {...props} key={option}>
          //     <Button
          //       sx={{
          //         height: '100%',
          //         width: '100%',
          //         display: 'flex',
          //         textAlign: 'left',
          //         justifyContent: 'start',
          //         fontWeight: 400,
          //         color: 'black',
          //         textTransform: 'none'
          //       }}
          //       id="region-filter-button"
          //       onClick={() => {
          //         setTimeout(() => {
          //           addFilter(REGION_FILTER_KEY, option, 'any');
          //           setIsOpen(false);
          //         }, 250);
          //       }}
          //     >
          //       {option}
          //     </Button>
          //   </li>
          // )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Region"
              onBlur={() => setIsOpen(false)}
              disabled={userLevel !== GLOBAL_ADMIN}
            />
          )}
          disabled={userLevel !== GLOBAL_ADMIN}
        />
      </Box>
      <List>
        {showUsersRegionDisabled && user?.regionId ? (
          <ListItem sx={{ padding: '0px' }} key={user?.regionId}>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox />}
                disabled={true}
                label={`Region ${user?.regionId}`}
                checked={true}
                sx={{ padding: '0px' }}
              />
            </FormGroup>
          </ListItem>
        ) : (
          regions.map((region) => {
            return (
              <RegionItem
                key={`region-item-${region}`}
                handleChange={handleCheckboxChange}
                regionId={region}
                checked={regionExistsInFilters(region) ?? false}
              />
            );
          })
        )}
      </List>
      {/* Need to reconcile type issues caused by adding freeSolo prop */}
      <Box padding={2}>
        <Autocomplete
          onInputChange={(e, v) => {
            if (e && e.type === 'change') {
              handleTextChange(v);
            }
          }}
          inputValue={searchTerm}
          // freeSolo
          disableClearable
          open={isOpen}
          onOpen={() => {
            setIsOpen(true);
          }}
          options={orgResults}
          onChange={(e, v) => {
            setTimeout(() => {
              handleAddOrganization(v);
            }, 250);
            return;
          }}
          getOptionLabel={(option) => option.name}
          ListboxProps={{
            sx: {
              ':active': {
                bgcolor: 'transparent'
              }
            }
          }}
          renderOption={(params, option) => {
            return (
              <li
                {...params}
                style={{ pointerEvents: 'none', padding: 0 }}
                key={option.id}
              >
                <Button
                  sx={{
                    pointerEvents: 'auto',
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    textAlign: 'left',
                    justifyContent: 'start',
                    fontWeight: 400,
                    color: 'black',
                    textTransform: 'none'
                  }}
                  id="search-org-button"
                  onClick={() =>
                    setTimeout(() => {
                      handleAddOrganization(option);
                    }, 250)
                  }
                >
                  {option.name}
                </Button>
              </li>
            );
          }}
          isOptionEqualToValue={(option, value) => option?.name === value?.name}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Organization"
              helperText="Use the dropdown to select the organization you want to view."
              onBlur={() => setIsOpen(false)}
              disabled={userLevel === STANDARD_USER}
            />
          )}
          disabled={userLevel === STANDARD_USER}
        />
      </Box>
      <List sx={{ width: '100%' }}>
        {organizationsInFilters?.map((org) => {
          return (
            <ListItem key={org.id} sx={{ padding: '0px' }}>
              <FormGroup>
                <FormControlLabel
                  sx={{ padding: '0px' }}
                  disabled={userLevel === STANDARD_USER}
                  label={org?.name}
                  control={<Checkbox />}
                  checked={true}
                  onChange={() => {
                    const exists = organizationsInFilters.find(
                      (organization) => organization.id === org.id
                    );
                    if (exists) {
                      removeFilter(ORGANIZATION_FILTER_KEY, org, 'any');
                    } else {
                      addFilter(ORGANIZATION_FILTER_KEY, org, 'any');
                    }
                  }}
                />
              </FormGroup>
            </ListItem>
          );
        })}
      </List>
      <br />
      <Stack spacing={2} padding={2} direction="column" alignItems="center">
        <Button variant="contained" sx={{ width: 'fit-content' }}>
          Apply Filters
        </Button>
        <Button variant="text" size="small">
          Reset
        </Button>
      </Stack>
    </>
  );
};

interface RegionItemProps {
  regionId: string;
  handleChange: (regionId: string) => void;
  checked: boolean;
}

const RegionItem: React.FC<RegionItemProps> = ({
  regionId: region,
  handleChange,
  checked
}) => {
  return (
    <ListItem sx={{ padding: '0px' }} key={`region-filter-item-${region}`}>
      <FormGroup>
        <FormControlLabel
          control={<Checkbox />}
          label={`Region ${region}`}
          checked={checked}
          onChange={() => {
            handleChange(region);
          }}
          sx={{ padding: '0px' }}
        />
      </FormGroup>
    </ListItem>
  );
};
